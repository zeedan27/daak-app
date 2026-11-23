"""TDD unit tests for Daak v2 deterministic engines and core utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core import SlidingWindowRateLimiter, TTLCache, emit_json_log, redact_sensitive_data
from app.engines import (
    calculate_area_safety_score,
    evaluate_false_report,
    haversine_meters,
    triage_daakai_prompt,
    validate_corroboration,
)


def _station(name_en: str, lat: float, lng: float, phone: str = "+8801320039660") -> dict:
    return {
        "id": f"st-{name_en.lower().replace(' ', '-')}",
        "name_en": name_en,
        "name_bn": name_en,
        "aliases": [name_en.split()[0].lower()],
        "district": "Dhaka",
        "division": "Dhaka",
        "phone": phone,
        "lat": lat,
        "lng": lng,
    }


def test_safety_score_empty_area_returns_100_safe() -> None:
    res = calculate_area_safety_score("Gulshan", [])
    assert res["score"] == 100
    assert res["level"] == "Safe"
    assert res["report_count"] == 0


def test_safety_score_penalizes_unresolved_night_crimes_more_than_resolved_daytime() -> None:
    day_resolved = [
        {
            "area_name": "Dhanmondi",
            "status": "resolved",
            "occurred_at": datetime(2026, 11, 23, 8, 0, tzinfo=timezone.utc),  # 14:00 BDT
        }
        for _ in range(4)
    ]
    night_unresolved = [
        {
            "area_name": "Mirpur-10",
            "status": "pending",
            "occurred_at": datetime(2026, 11, 23, 17, 0, tzinfo=timezone.utc),  # 23:00 BDT
        }
        for _ in range(4)
    ]
    day_res = calculate_area_safety_score("Dhanmondi", day_resolved)
    night_res = calculate_area_safety_score("Mirpur-10", night_unresolved)
    assert day_res["score"] > night_res["score"]
    assert day_res["factors"]["resolution_rate"] == 100
    assert night_res["factors"]["resolution_rate"] == 0


def test_false_report_detector_flags_spam_and_discounts_corroboration() -> None:
    now = datetime(2026, 11, 23, 12, 0, tzinfo=timezone.utc)
    existing = [
        {
            "id": "rep-1",
            "reporter_id": "u-spam",
            "category": "snatching",
            "area_name": "Mohammadpur",
            "lat": 23.7638,
            "lng": 90.3636,
            "status": "pending",
            "created_at": now - timedelta(minutes=10),
            "description": "snatching happened here",
        },
        {
            "id": "rep-2",
            "reporter_id": "u-spam",
            "category": "snatching",
            "area_name": "Mohammadpur",
            "lat": 23.7639,
            "lng": 90.3637,
            "status": "pending",
            "created_at": now - timedelta(minutes=5),
            "description": "snatching happened here",
        },
    ]
    spam_candidate = {
        "id": "rep-new",
        "reporter_id": "u-spam",
        "category": "snatching",
        "area_name": "Mohammadpur",
        "lat": 23.7639,
        "lng": 90.3637,
        "created_at": now,
        "title": "test free reward http://bit.ly/spam",
        "description": "test",
    }
    flagged = evaluate_false_report(
        spam_candidate,
        existing,
        reporter_profile={"credibility_score": 45, "is_verified": False},
        corroboration_count=0,
    )
    assert flagged["suspicion_score"] >= 50
    assert flagged["flag_status"] == "flagged"
    assert len(flagged["reasons"]) >= 2

    credible_candidate = {
        "id": "rep-real",
        "reporter_id": "u-trusted",
        "category": "snatching",
        "area_name": "Dhanmondi",
        "lat": 23.7495,
        "lng": 90.3806,
        "created_at": now,
        "title": "Phone snatching near Kalabagan footover bridge",
        "description": "Two riders on a motorcycle snatched a phone near the east stair exit around 19:45.",
    }
    trusted = evaluate_false_report(
        credible_candidate,
        existing,
        reporter_profile={"credibility_score": 88, "is_verified": True},
        corroboration_count=3,
    )
    assert trusted["suspicion_score"] < 50
    assert trusted["flag_status"] == "none"


def test_corroboration_enforces_1km_radius_and_no_self_or_duplicate() -> None:
    report = {"id": "r-1", "reporter_id": "owner-1", "lat": 23.7495, "lng": 90.3806}
    # ~110m away
    ok, code, dist = validate_corroboration(
        report=report,
        user_id="witness-1",
        user_lat=23.7503,
        user_lng=90.3811,
        existing_user_ids=set(),
    )
    assert ok is True
    assert code is None
    assert dist <= 1000.0

    # ~3.5 km away (Mirpur vs Dhanmondi)
    ok_far, code_far, dist_far = validate_corroboration(
        report=report,
        user_id="witness-2",
        user_lat=23.8069,
        user_lng=90.3688,
        existing_user_ids=set(),
    )
    assert ok_far is False
    assert code_far == "CORROBORATION_OUT_OF_RANGE"
    assert dist_far > 1000.0

    ok_self, code_self, _ = validate_corroboration(
        report=report,
        user_id="owner-1",
        user_lat=23.7495,
        user_lng=90.3806,
        existing_user_ids=set(),
    )
    assert ok_self is False
    assert code_self == "SELF_CORROBORATION_FORBIDDEN"

    ok_dup, code_dup, _ = validate_corroboration(
        report=report,
        user_id="witness-1",
        user_lat=23.7496,
        user_lng=90.3806,
        existing_user_ids={"witness-1"},
    )
    assert ok_dup is False
    assert code_dup == "DUPLICATE_CORROBORATION"


def test_daakai_understands_bangla_and_banglish_and_finds_nearest_thana() -> None:
    stations = [
        _station("Dhanmondi Model Police Station", 23.7461, 90.3742, "+8801320039660"),
        _station("Mirpur Model Police Station", 23.8069, 90.3688, "+8801320041200"),
    ]
    reports = [
        {"area_name": "Mirpur-10", "category": "harassment", "status": "investigating", "title": "Gate B harassment"}
    ]
    banglish = triage_daakai_prompt(
        prompt="Mirpur 10 e raat e hata safe?",
        stations=stations,
        reports=reports,
        user_lat=23.8065,
        user_lng=90.3692,
    )
    assert "Mirpur" in banglish["area"]
    assert banglish["nearest_thana"]["name_en"] == "Mirpur Model Police Station"
    assert banglish["local_report_count"] >= 1

    bangla = triage_daakai_prompt(
        prompt="ধানমন্ডি তে ছিনতাই হয়েছে, কাছের থানা কোথায়?",
        stations=stations,
        reports=reports,
        user_lat=23.7465,
        user_lng=90.3760,
    )
    assert bangla["area"] == "Dhanmondi"
    assert bangla["nearest_thana"]["name_en"] == "Dhanmondi Model Police Station"
    assert haversine_meters(23.7461, 90.3742, 23.7324, 90.3954) > 2500


def test_rate_limiter_cache_and_log_redaction() -> None:
    limiter = SlidingWindowRateLimiter()
    allowed_1, _ = limiter.check("u1:ai", max_requests=2, window_seconds=60)
    allowed_2, _ = limiter.check("u1:ai", max_requests=2, window_seconds=60)
    allowed_3, retry_after = limiter.check("u1:ai", max_requests=2, window_seconds=60)
    assert allowed_1 and allowed_2
    assert not allowed_3
    assert retry_after >= 1

    cache = TTLCache(ttl_seconds=30, max_entries=2)
    cache.set("k1", {"score": 82})
    assert cache.get("k1") == {"score": 82}
    cache.invalidate_prefix("k")
    assert cache.get("k1") is None
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert cache.get("a") is None
    assert cache.get("b") == 2 and cache.get("c") == 3

    redacted = redact_sensitive_data({"Authorization": "Bearer secret_999", "area": "Dhanmondi"})
    assert redacted["Authorization"] == "[REDACTED]"
    assert redacted["area"] == "Dhanmondi"
    log_line = emit_json_log("api.test", "req-1", {"AI_API_KEY": "sk-live-secret"})
    assert "sk-live-secret" not in log_line
