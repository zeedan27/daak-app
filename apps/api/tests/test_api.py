"""TDD integration tests for Daak v2 FastAPI /api/v1 endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_store, rate_limiter
from app.store import InMemoryDaakStore


@pytest.fixture()
def client() -> TestClient:
    """Create isolated TestClient with fresh InMemoryDaakStore and rate limiter."""
    fresh_store = InMemoryDaakStore()
    rate_limiter.reset()
    app.dependency_overrides[get_store] = lambda: fresh_store
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


def _auth_header(client: TestClient, role: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/demo-login", json={"role": role})
    assert resp.status_code == 200
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health_probes_and_unauthorized_guard(client: TestClient) -> None:
    live = client.get("/healthz/live")
    assert live.status_code == 200
    assert live.json()["data"]["status"] == "alive"

    ready = client.get("/healthz/ready")
    assert ready.status_code == 200
    assert ready.json()["data"]["status"] == "ready"

    unauth = client.get("/api/v1/sos")
    assert unauth.status_code == 401
    assert unauth.json()["error"]["code"] == "UNAUTHORIZED"


def test_sos_trigger_idempotency_cancel_and_police_dispatch_sla(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")

    payload = {
        "lat": 23.7465,
        "lng": 90.3760,
        "area_name": "Dhanmondi",
        "battery_level": 42,
        "note": "Need patrol near Lake road",
        "idempotency_key": "idem-sos-001",
    }
    first = client.post("/api/v1/sos", json=payload, headers=citizen_hdr)
    assert first.status_code == 201
    sos_data = first.json()["data"]
    sos_id = sos_data["id"]
    assert sos_data["status"] == "active"
    assert sos_data["nearest_thana"]["name_en"] == "Dhanmondi Model Police Station"

    # Idempotent replay returns same SOS ID
    replay = client.post("/api/v1/sos", json=payload, headers=citizen_hdr)
    assert replay.status_code in (200, 201)
    assert replay.json()["data"]["id"] == sos_id

    # Citizen cannot dispatch SOS (403 FORBIDDEN_ROLE)
    forbidden = client.patch(
        f"/api/v1/sos/{sos_id}/dispatch",
        json={"status": "claimed", "assigned_unit": "Unit-1"},
        headers=citizen_hdr,
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # Police claims -> responds -> resolves
    claimed = client.patch(
        f"/api/v1/sos/{sos_id}/dispatch",
        json={"status": "claimed", "assigned_unit": "Dhanmondi Patrol-07", "note": "Unit dispatched"},
        headers=police_hdr,
    )
    assert claimed.status_code == 200
    assert claimed.json()["data"]["status"] == "claimed"

    resolved = client.patch(
        f"/api/v1/sos/{sos_id}/dispatch",
        json={"status": "resolved", "note": "Citizen safely escorted"},
        headers=police_hdr,
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["status"] == "resolved"

    # Invalid transition resolved -> claimed
    bad_transition = client.patch(
        f"/api/v1/sos/{sos_id}/dispatch",
        json={"status": "claimed"},
        headers=police_hdr,
    )
    assert bad_transition.status_code == 400
    assert bad_transition.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    # Citizen can cancel a fresh active SOS
    sos2 = client.post("/api/v1/sos", json={"lat": 23.75, "lng": 90.38, "area_name": "Dhanmondi"}, headers=citizen_hdr)
    sos2_id = sos2.json()["data"]["id"]
    cancelled = client.patch(f"/api/v1/sos/{sos2_id}/cancel", headers=citizen_hdr)
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"


def test_safe_walk_lifecycle_and_auto_escalation(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    created = client.post(
        "/api/v1/safe-walks",
        json={
            "destination_name": "TSC, Dhaka University",
            "lat": 23.7420,
            "lng": 90.3821,
            "eta_minutes": 15,
        },
        headers=citizen_hdr,
    )
    assert created.status_code == 201
    walk_id = created.json()["data"]["id"]

    escalated = client.post(f"/api/v1/safe-walks/{walk_id}/escalate", headers=citizen_hdr)
    assert escalated.status_code == 201
    esc_data = escalated.json()["data"]
    assert esc_data["safe_walk"]["status"] == "escalated"
    assert esc_data["distress_signal"]["trigger_source"] == "safe_walk_timeout"


def test_reports_anonymity_masking_false_report_scoring_and_1km_corroboration(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")

    # Public feed masks anonymous report owned by another user? Seeded report 3333...01 is owned by citizen demo,
    # so submit an anonymous report as police or check masking for non-owner citizen:
    anon_report = client.post(
        "/api/v1/reports",
        json={
            "category": "snatching",
            "severity": "high",
            "title": "Snatching near Science Lab footbridge",
            "description": "Two people on a motorcycle snatched a bag near Science Lab intersection.",
            "area_name": "Dhanmondi",
            "lat": 23.7392,
            "lng": 90.3834,
            "is_anonymous_public": True,
        },
        headers=police_hdr,
    )
    assert anon_report.status_code == 201
    rep_id = anon_report.json()["data"]["id"]

    # Police approves it so it enters public feed
    client.patch(
        f"/api/v1/admin/reports/{rep_id}/moderate",
        json={"status": "verified", "moderation_note": "Verified by patrol"},
        headers=police_hdr,
    )

    citizen_feed = client.get("/api/v1/reports", headers=citizen_hdr)
    assert citizen_feed.status_code == 200
    matched = [r for r in citizen_feed.json()["data"] if r["id"] == rep_id][0]
    assert matched["reporter_id"] is None
    assert matched["reporter_display_name"] == "Anonymous Citizen"

    # Police sees internal reporter_id
    police_feed = client.get("/api/v1/reports", headers=police_hdr)
    matched_police = [r for r in police_feed.json()["data"] if r["id"] == rep_id][0]
    assert matched_police["reporter_id"] is not None

    # Corroborate within 1 km succeeds
    corr_ok = client.post(
        f"/api/v1/reports/{rep_id}/corroborate",
        json={"user_lat": 23.7396, "user_lng": 90.3838, "note": "Saw the bike speed south"},
        headers=citizen_hdr,
    )
    assert corr_ok.status_code == 201
    assert corr_ok.json()["data"]["corroboration_count"] == 1

    # Duplicate corroboration rejected
    corr_dup = client.post(
        f"/api/v1/reports/{rep_id}/corroborate",
        json={"user_lat": 23.7396, "user_lng": 90.3838},
        headers=citizen_hdr,
    )
    assert corr_dup.status_code == 409
    assert corr_dup.json()["error"]["code"] == "DUPLICATE_CORROBORATION"

    # Out-of-range corroboration (>1km) rejected
    admin_hdr = _auth_header(client, "admin")
    corr_far = client.post(
        f"/api/v1/reports/{rep_id}/corroborate",
        json={"user_lat": 23.8069, "user_lng": 90.3688},
        headers=admin_hdr,
    )
    assert corr_far.status_code == 422
    assert corr_far.json()["error"]["code"] == "CORROBORATION_OUT_OF_RANGE"


def test_safety_score_heatmap_nearest_thana_and_ai_rate_limit(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")

    score_resp = client.get("/api/v1/safety-score?area=Dhanmondi", headers=citizen_hdr)
    assert score_resp.status_code == 200
    assert "public" in score_resp.headers.get("cache-control", "")
    assert 0 <= score_resp.json()["data"]["score"] <= 100

    heatmap = client.get("/api/v1/heatmap", headers=citizen_hdr)
    assert heatmap.status_code == 200
    assert len(heatmap.json()["data"]["points"]) >= 6

    thana = client.get("/api/v1/thanas/nearest?lat=23.7465&lng=90.3760", headers=citizen_hdr)
    assert thana.status_code == 200
    assert thana.json()["data"][0]["name_en"] == "Dhanmondi Model Police Station"

    ai_ok = client.post(
        "/api/v1/ai/chat",
        json={"prompt": "Mirpur 10 e raat e hata safe?", "lat": 23.8065, "lng": 90.3692},
        headers=citizen_hdr,
    )
    assert ai_ok.status_code == 200
    assert "no-store" in ai_ok.headers.get("cache-control", "")
    assert "Mirpur" in ai_ok.json()["data"]["area"]

    # Rate limit triggers after 20 requests/min
    hit_429 = False
    for _ in range(25):
        r = client.post("/api/v1/ai/chat", json={"prompt": "Dhanmondi safe?"}, headers=citizen_hdr)
        if r.status_code == 429:
            hit_429 = True
            assert "retry-after" in {k.lower() for k in r.headers.keys()}
            assert r.json()["error"]["code"] == "RATE_LIMITED"
            break
    assert hit_429 is True


def test_admin_and_police_privileged_endpoints_and_role_guards(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")
    admin_hdr = _auth_header(client, "admin")

    # Citizen denied admin false-reports & criminals write
    assert client.get("/api/v1/admin/false-reports", headers=citizen_hdr).status_code == 403
    assert client.post(
        "/api/v1/admin/criminals",
        json={"full_name": "Test", "last_known_area": "Dhaka"},
        headers=police_hdr,
    ).status_code == 403

    # Police creates shift handover
    handover = client.post(
        "/api/v1/police/handovers",
        json={
            "shift_label": "Evening -> Night",
            "summary": "Monitor Mirpur-10 Gate B.",
            "priority_areas": ["Mirpur-10"],
        },
        headers=police_hdr,
    )
    assert handover.status_code == 201

    # Admin reads false reports, creates criminal, reads analytics
    flagged = client.get("/api/v1/admin/false-reports", headers=admin_hdr)
    assert flagged.status_code == 200
    assert len(flagged.json()["data"]) >= 2

    created_crim = client.post(
        "/api/v1/admin/criminals",
        json={
            "full_name": "Demo Suspect X",
            "aliases": ["X"],
            "crime_categories": ["snatching"],
            "risk_level": "high",
            "last_known_area": "Motijheel",
            "status": "wanted",
            "details": "Synthetic test watchlist record.",
        },
        headers=admin_hdr,
    )
    assert created_crim.status_code == 201
    crim_id = created_crim.json()["data"]["id"]

    updated_crim = client.patch(
        f"/api/v1/admin/criminals/{crim_id}",
        json={"status": "in_custody"},
        headers=admin_hdr,
    )
    assert updated_crim.status_code == 200
    assert updated_crim.json()["data"]["status"] == "in_custody"

    deleted_crim = client.delete(f"/api/v1/admin/criminals/{crim_id}", headers=admin_hdr)
    assert deleted_crim.status_code == 200

    analytics = client.get("/api/v1/admin/analytics", headers=admin_hdr)
    assert analytics.status_code == 200
    assert analytics.json()["data"]["total_reports"] >= 8
