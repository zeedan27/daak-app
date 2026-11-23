"""TDD integration tests for Daak v2 FastAPI /api/v1 endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
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
    police_hdr = _auth_header(client, "police")

    score_resp = client.get("/api/v1/safety-score?area=Dhanmondi", headers=citizen_hdr)
    assert score_resp.status_code == 200
    score_cc = score_resp.headers.get("cache-control", "")
    assert "private" in score_cc
    assert "public" not in score_cc
    assert "s-maxage" not in score_cc
    assert 0 <= score_resp.json()["data"]["score"] <= 100

    heatmap = client.get("/api/v1/heatmap", headers=citizen_hdr)
    assert heatmap.status_code == 200
    hm_cc = heatmap.headers.get("cache-control", "")
    assert "private" in hm_cc
    assert "public" not in hm_cc
    assert len(heatmap.json()["data"]["points"]) >= 6

    staff_heatmap = client.get("/api/v1/heatmap?include_sos=true", headers=police_hdr)
    assert staff_heatmap.status_code == 200
    assert "no-store" in staff_heatmap.headers.get("cache-control", "")

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


def test_cross_user_sos_idempotency_isolation(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")

    c_res = client.post(
        "/api/v1/sos",
        json={"lat": 23.7465, "lng": 90.3760, "area_name": "Dhanmondi", "idempotency_key": "shared-key"},
        headers=citizen_hdr,
    )
    p_res = client.post(
        "/api/v1/sos",
        json={"lat": 23.8069, "lng": 90.3688, "area_name": "Mirpur-10", "idempotency_key": "shared-key"},
        headers=police_hdr,
    )
    assert c_res.status_code == 201
    assert p_res.status_code == 201
    assert c_res.json()["data"]["id"] != p_res.json()["data"]["id"]
    assert p_res.json()["data"]["area_name"] == "Mirpur-10"


def test_moderate_report_atomicity_and_idempotent_credibility_penalty(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")
    admin_hdr = _auth_header(client, "admin")

    store = app.dependency_overrides[get_store]()
    initial_cred = store.profiles["11111111-1111-4111-8111-111111111101"]["credibility_score"]

    created = client.post(
        "/api/v1/reports",
        json={
            "category": "vandalism",
            "severity": "low",
            "title": "test free reward http://bit.ly/spam2",
            "description": "test",
            "area_name": "Mohammadpur",
            "lat": 23.7638,
            "lng": 90.3636,
        },
        headers=citizen_hdr,
    )
    assert created.status_code == 201
    rep_id = created.json()["data"]["id"]
    assert store.reports[0]["flag_status"] == "flagged"

    # Police attempting both status + flag_status must fail 403 WITHOUT mutating status
    police_attempt = client.patch(
        f"/api/v1/admin/reports/{rep_id}/moderate",
        json={"status": "verified", "flag_status": "confirmed_false"},
        headers=police_hdr,
    )
    assert police_attempt.status_code == 403
    assert store.reports[0]["status"] == "pending"

    # Admin confirms false twice -> credibility drops only once (-15)
    admin_1 = client.patch(
        f"/api/v1/admin/reports/{rep_id}/moderate",
        json={"flag_status": "confirmed_false"},
        headers=admin_hdr,
    )
    assert admin_1.status_code == 200
    assert store.profiles["11111111-1111-4111-8111-111111111101"]["credibility_score"] == initial_cred - 15

    admin_2 = client.patch(
        f"/api/v1/admin/reports/{rep_id}/moderate",
        json={"flag_status": "confirmed_false"},
        headers=admin_hdr,
    )
    assert admin_2.status_code == 200
    assert store.profiles["11111111-1111-4111-8111-111111111101"]["credibility_score"] == initial_cred - 15


def test_non_anon_reporter_id_hidden_and_rejected_report_hidden_on_tips_corroboration(client: TestClient) -> None:
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")

    created = client.post(
        "/api/v1/reports",
        json={
            "category": "theft",
            "severity": "medium",
            "title": "Public non-anonymous patrol report",
            "description": "Bicycle theft observed near Dhanmondi Lake bridge.",
            "area_name": "Dhanmondi",
            "lat": 23.7465,
            "lng": 90.3760,
            "is_anonymous_public": False,
        },
        headers=police_hdr,
    )
    rep_id = created.json()["data"]["id"]
    client.patch(f"/api/v1/admin/reports/{rep_id}/moderate", json={"status": "verified"}, headers=police_hdr)

    feed = client.get("/api/v1/reports", headers=citizen_hdr).json()["data"]
    item = next(r for r in feed if r["id"] == rep_id)
    assert item["reporter_id"] is None
    assert item["reporter_display_name"] == "SI Tariqul Islam"

    # Reject report -> citizen cannot view tips, post tips, or corroborate
    client.patch(f"/api/v1/admin/reports/{rep_id}/moderate", json={"status": "rejected"}, headers=police_hdr)
    assert client.get(f"/api/v1/reports/{rep_id}/tips", headers=citizen_hdr).status_code == 404
    assert client.post(f"/api/v1/reports/{rep_id}/tips", json={"body": "tip"}, headers=citizen_hdr).status_code == 404
    assert (
        client.post(
            f"/api/v1/reports/{rep_id}/corroborate",
            json={"user_lat": 23.7465, "user_lng": 90.3760},
            headers=citizen_hdr,
        ).status_code
        == 404
    )


def test_safe_walk_extend_preserves_remaining_time_and_heatmap_filters_spam(client: TestClient) -> None:
    from datetime import datetime, timezone

    citizen_hdr = _auth_header(client, "citizen")
    walk = client.post(
        "/api/v1/safe-walks",
        json={"destination_name": "Farmgate", "lat": 23.75, "lng": 90.38, "eta_minutes": 30},
        headers=citizen_hdr,
    ).json()["data"]
    orig_eta = datetime.fromisoformat(walk["expected_arrival_at"])
    ext = client.patch(
        f"/api/v1/safe-walks/{walk['id']}/checkin",
        json={"action": "extend", "extend_minutes": 10},
        headers=citizen_hdr,
    )
    assert ext.status_code == 200
    new_eta = datetime.fromisoformat(ext.json()["data"]["expected_arrival_at"])
    assert (new_eta - orig_eta).total_seconds() >= 590

    # Heatmap excludes flagged spam reports (3333...07, 3333...08)
    heatmap = client.get("/api/v1/heatmap", headers=citizen_hdr).json()["data"]
    ids = {p["id"] for p in heatmap["points"]}
    assert "33333333-3333-4333-8333-333333333307" not in ids
    assert "33333333-3333-4333-8333-333333333308" not in ids

    # Radius-based safety score works
    rad_score = client.get("/api/v1/safety-score?lat=23.7495&lng=90.3806&radius_m=2000", headers=citizen_hdr)
    assert rad_score.status_code == 200
    assert rad_score.json()["data"]["report_count"] >= 1


def test_demo_mode_disabled_criminal_visibility_and_supabase_store_contract(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.store import SupabaseDaakStore

    admin_hdr = _auth_header(client, "admin")
    citizen_hdr = _auth_header(client, "citizen")
    police_hdr = _auth_header(client, "police")

    # Archived criminal hidden from citizen, visible to admin
    arch = client.post(
        "/api/v1/admin/criminals",
        json={"full_name": "Archived Person", "last_known_area": "Dhaka", "status": "archived"},
        headers=admin_hdr,
    ).json()["data"]
    assert all(c["id"] != arch["id"] for c in client.get("/api/v1/criminals", headers=citizen_hdr).json()["data"])
    assert any(c["id"] == arch["id"] for c in client.get("/api/v1/criminals", headers=admin_hdr).json()["data"])

    # Police sees only own logs; admin sees all
    p_logs = client.get("/api/v1/admin/logs", headers=police_hdr).json()["data"]
    a_logs = client.get("/api/v1/admin/logs", headers=admin_hdr).json()["data"]
    assert all(l["actor_id"] == "11111111-1111-4111-8111-111111111102" for l in p_logs)
    assert len(a_logs) >= len(p_logs)

    # DEMO_MODE=false blocks demo login
    monkeypatch.setenv("DEMO_MODE", "false")
    disabled = client.post("/api/v1/auth/demo-login", json={"role": "citizen"})
    assert disabled.status_code == 403
    assert disabled.json()["error"]["code"] == "DEMO_MODE_DISABLED"
    monkeypatch.setenv("DEMO_MODE", "true")

    # SupabaseDaakStore resolves role from public.profiles (never user_metadata) and checks DB readiness
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": "real-uid-1", "email": "officer@bd.gov", "user_metadata": {"role": "admin"}})
        if req.url.path == "/rest/v1/profiles":
            return httpx.Response(200, json=[{"id": "real-uid-1", "full_name": "Inspector Karim", "role": "police", "credibility_score": 95}])
        if req.url.path == "/rest/v1/police_stations":
            return httpx.Response(200, json=[{"id": "22222222-2222-4222-8222-222222222201"}])
        return httpx.Response(200, json=[])

    sb_store = SupabaseDaakStore(
        supabase_url="https://example.supabase.co",
        anon_key="pub-key",
        service_role_key="srv-key",
        transport=httpx.MockTransport(handler),
    )
    import asyncio
    resolved = asyncio.run(sb_store.resolve_user_from_token("real-jwt"))
    assert resolved is not None
    assert resolved["role"] == "police"
    assert resolved["full_name"] == "Inspector Karim"
    assert asyncio.run(sb_store.check_readiness()) is True


def test_readiness_returns_503_when_shutting_down(client: TestClient) -> None:
    prev = main_module._is_shutting_down
    main_module._is_shutting_down = True
    try:
        draining = client.get("/healthz/ready")
        assert draining.status_code == 503
        assert draining.json()["data"]["status"] == "draining"
        assert "no-store" in draining.headers.get("cache-control", "")
    finally:
        main_module._is_shutting_down = prev

