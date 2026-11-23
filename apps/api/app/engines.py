"""Deterministic geospatial, safety-score, false-report, corroboration, and DaakAI engines."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

BD_TIMEZONE = timezone(timedelta(hours=6))
CORROBORATION_MAX_METERS = 1000.0
SUSPICIOUS_TERMS = (
    "http://",
    "https://",
    "bit.ly",
    "click link",
    "free reward",
    "promo",
    "test test",
    "asdf",
    "fake",
)

AREA_KEYWORDS: dict[str, tuple[str, list[str]]] = {
    "Dhanmondi": ("Dhanmondi", ["dhanmondi", "kalabagan", "science lab", "jigatola", "ধানমন্ডি", "কলাবাগান"]),
    "Mirpur-10": ("Mirpur-10", ["mirpur", "mirpur-10", "mirpur 10", "kazipara", "shewrapara", "মিরপুর"]),
    "Shahbagh": ("Shahbagh", ["shahbagh", "tsc", "dhaka university", "ramna", "শাহবাগ", "টিএসসি"]),
    "Mohammadpur": ("Mohammadpur", ["mohammadpur", "bosila", "adabor", "lalmatia", "মোহাম্মদপুর"]),
    "Uttara": ("Uttara", ["uttara", "azampur", "sector 7", "উত্তরা"]),
    "Gulshan": ("Gulshan", ["gulshan", "banani", "baridhara", "গুলশান", "বনানী"]),
    "Motijheel": ("Motijheel", ["motijheel", "paltan", "kamalapur", "মতিঝিল"]),
    "Chattogram": ("Chattogram", ["chattogram", "chittagong", "kotwali", "agrabad", "চট্টগ্রাম"]),
}

CRIME_KEYWORDS: list[tuple[str, list[str]]] = [
    ("snatching", ["snatch", "chintai", "ছিনতাই", "mug"]),
    ("harassment", ["harass", "stalk", "eve", "হয়রানি", "ইভটিজিং"]),
    ("theft", ["theft", "stolen", "churi", "চুরি", "bike", "cycle"]),
    ("assault", ["assault", "attack", "maramari", "হামলা", "মারামারি"]),
    ("fraud", ["fraud", "scam", "bkash", "প্রতারণা"]),
]


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute WGS84 great-circle distance in meters."""
    earth_radius_m = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return round(2 * earth_radius_m * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def _parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def get_safety_level(score: int) -> str:
    """Map numeric safety score (0-100) to categorical label."""
    if score >= 75:
        return "Safe"
    if score >= 50:
        return "Moderate"
    if score >= 30:
        return "Caution"
    return "High Risk"


def calculate_area_safety_score(area: str, reports: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate area safety score using 40% frequency, 35% resolution, and 25% night/day weighting."""
    active_reports = [r for r in reports if r.get("status") != "rejected"]
    total = len(active_reports)
    if total == 0:
        return {
            "area": area,
            "score": 100,
            "level": "Safe",
            "report_count": 0,
            "resolved_count": 0,
            "factors": {"crime_frequency": 100, "resolution_rate": 100, "time_of_day": 100},
        }

    crime_frequency_score = max(10.0, 100.0 - min(total, 15) * 6.0)
    resolved_count = sum(1 for r in active_reports if r.get("status") == "resolved")
    resolution_rate_score = (resolved_count / total) * 100.0

    night_count = 0
    for report in active_reports:
        dt_bdt = _parse_dt(report.get("occurred_at") or report.get("created_at")).astimezone(BD_TIMEZONE)
        if dt_bdt.hour >= 20 or dt_bdt.hour < 5:
            night_count += 1
    night_ratio = night_count / total
    time_of_day_score = max(15.0, 100.0 - night_ratio * 70.0)

    overall = round(
        crime_frequency_score * 0.40 + resolution_rate_score * 0.35 + time_of_day_score * 0.25
    )
    overall = max(0, min(100, overall))

    return {
        "area": area,
        "score": overall,
        "level": get_safety_level(overall),
        "report_count": total,
        "resolved_count": resolved_count,
        "factors": {
            "crime_frequency": round(crime_frequency_score),
            "resolution_rate": round(resolution_rate_score),
            "time_of_day": round(time_of_day_score),
        },
    }


def evaluate_false_report(
    candidate: dict[str, Any],
    existing_reports: list[dict[str, Any]],
    reporter_profile: dict[str, Any] | None = None,
    corroboration_count: int = 0,
) -> dict[str, Any]:
    """Compute 5-factor false-report suspicion score (0-100) and flag status."""
    reasons: list[str] = []
    reporter_id = candidate.get("reporter_id")
    profile = reporter_profile or {}

    # 1. User credibility factor (lower credibility -> higher suspicion)
    credibility = int(profile.get("credibility_score", 75))
    if profile.get("is_verified"):
        credibility = min(100, credibility + 10)
    user_suspicion = max(0, min(100, 100 - credibility))
    if user_suspicion >= 45:
        reasons.append("Low historical reporter credibility")

    # 2. Duplicate/near-duplicate spatial + category pattern within 500m & 60 min
    cand_dt = _parse_dt(candidate.get("created_at"))
    dup_hits = 0
    rapid_hits = 0
    for item in existing_reports:
        if item.get("id") == candidate.get("id"):
            continue
        item_dt = _parse_dt(item.get("created_at"))
        delta_min = abs((cand_dt - item_dt).total_seconds()) / 60.0
        if item.get("reporter_id") == reporter_id and delta_min <= 30.0:
            rapid_hits += 1
        if item.get("category") == candidate.get("category") and delta_min <= 60.0:
            dist = haversine_meters(
                float(candidate.get("lat", 0.0)),
                float(candidate.get("lng", 0.0)),
                float(item.get("lat", 0.0)),
                float(item.get("lng", 0.0)),
            )
            if dist <= 500.0:
                dup_hits += 1

    duplicate_score = 85 if dup_hits >= 2 else (45 if dup_hits == 1 else 0)
    if duplicate_score >= 45:
        reasons.append("Near-duplicate spatial and category report within 60 minutes")

    # 3. Rapid submission spam
    rapid_score = 90 if rapid_hits >= 2 else (45 if rapid_hits == 1 else 0)
    if rapid_score >= 45:
        reasons.append("Rapid submission pattern within 30 minutes")

    # 4. Detail consistency
    desc = str(candidate.get("description", "")).strip()
    title = str(candidate.get("title", "")).strip()
    detail_score = 0
    if len(desc) < 20:
        detail_score += 55
        reasons.append("Short generic description")
    if len(title) < 8:
        detail_score += 25

    # 5. Suspicious content
    combined = f"{title} {desc}".lower()
    content_hits = sum(1 for term in SUSPICIOUS_TERMS if term in combined)
    content_score = min(100, content_hits * 45)
    if content_score > 0:
        reasons.append("Suspicious promotional link or test keyword detected")

    weighted = (
        user_suspicion * 0.20
        + duplicate_score * 0.25
        + rapid_score * 0.20
        + min(100, detail_score) * 0.15
        + content_score * 0.20
    )

    # Community corroboration trust discount
    trust_discount = min(30, corroboration_count * 10)
    final_score = max(0, min(100, round(weighted - trust_discount)))
    flag_status = "flagged" if final_score >= 50 else "none"

    return {
        "suspicion_score": final_score,
        "flag_status": flag_status,
        "reasons": reasons,
        "factors": {
            "user_credibility": user_suspicion,
            "duplicate_pattern": duplicate_score,
            "rapid_submission": rapid_score,
            "detail_consistency": min(100, detail_score),
            "suspicious_content": content_score,
            "corroboration_discount": trust_discount,
        },
    }


def validate_corroboration(
    report: dict[str, Any],
    user_id: str,
    user_lat: float,
    user_lng: float,
    existing_user_ids: set[str],
) -> tuple[bool, str | None, float]:
    """Validate 1km proximity, non-self ownership, and uniqueness for 'I Saw This Too'."""
    distance = haversine_meters(
        float(report["lat"]),
        float(report["lng"]),
        float(user_lat),
        float(user_lng),
    )
    if report.get("reporter_id") == user_id:
        return False, "SELF_CORROBORATION_FORBIDDEN", distance
    if user_id in existing_user_ids:
        return False, "DUPLICATE_CORROBORATION", distance
    if distance > CORROBORATION_MAX_METERS:
        return False, "CORROBORATION_OUT_OF_RANGE", distance
    return True, None, distance


def find_nearest_thanas(
    stations: list[dict[str, Any]],
    lat: float | None = None,
    lng: float | None = None,
    query: str | None = None,
    limit: int = 3,
) -> list[dict[str, Any]]:
    """Rank Bangladesh Thanas by coordinate distance or Bangla/Banglish text match."""
    q = (query or "").strip().lower()
    results: list[dict[str, Any]] = []
    for station in stations:
        item = dict(station)
        dist = (
            haversine_meters(lat, lng, float(station["lat"]), float(station["lng"]))
            if lat is not None and lng is not None
            else None
        )
        item["distance_meters"] = dist
        haystack = " ".join(
            [station.get("name_en", ""), station.get("name_bn", ""), *station.get("aliases", [])]
        ).lower()
        text_score = 0
        if q:
            if q in haystack:
                text_score = 2
            elif any(token in haystack for token in q.split() if len(token) >= 2):
                text_score = 1
        item["_rank"] = (-text_score, dist if dist is not None else 9_999_999.0)
        results.append(item)

    results.sort(key=lambda s: s["_rank"])
    trimmed: list[dict[str, Any]] = []
    for item in results[:limit]:
        item.pop("_rank", None)
        trimmed.append(item)
    return trimmed


def triage_daakai_prompt(
    prompt: str,
    stations: list[dict[str, Any]],
    reports: list[dict[str, Any]],
    user_lat: float | None = None,
    user_lng: float | None = None,
) -> dict[str, Any]:
    """Deterministic Bangla/Banglish/English safety triage grounded in local reports and nearest Thana."""
    lowered = prompt.lower()

    matched_area = None
    for canonical, keywords in AREA_KEYWORDS.values():
        if any(kw in lowered for kw in keywords):
            matched_area = canonical
            break

    matched_category = "general"
    for category, keywords in CRIME_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            matched_category = category
            break

    nearest_list = find_nearest_thanas(
        stations=stations,
        lat=user_lat,
        lng=user_lng,
        query=matched_area or prompt,
        limit=1,
    )
    nearest = nearest_list[0] if nearest_list else {
        "name_en": "National Emergency Service",
        "name_bn": "জাতীয় জরুরি সেবা",
        "phone": "999",
        "distance_meters": None,
    }
    area_label = matched_area or nearest.get("district", "Dhaka Metro")

    area_lower = area_label.lower().split("-")[0]
    local_reports = [
        r for r in reports
        if r.get("status") != "rejected" and area_lower in str(r.get("area_name", "")).lower()
    ]

    urgent_keywords = ("help", "danger", "sos", "bachao", "বাঁচাও", "ছিনতাই", "follow", "attack")
    is_urgent = any(term in lowered for term in urgent_keywords)

    guidance_lines = [
        f"Area context ({area_label}): {len(local_reports)} active/recent report(s) recorded.",
        f"Nearest Thana: {nearest['name_en']} ({nearest['phone']}).",
    ]
    if is_urgent:
        guidance_lines.insert(
            0,
            "Immediate safety priority: Move into a lit, populated shop or transit gate and trigger Daak SOS or call 999.",
        )
    else:
        guidance_lines.append(
            "Safety tip: Keep a Safe Walk timer active when commuting at night and stick to main lit roads."
        )

    return {
        "mode": "deterministic_fallback",
        "area": area_label,
        "detected_category": matched_category,
        "is_urgent": is_urgent,
        "local_report_count": len(local_reports),
        "nearest_thana": nearest,
        "reply": " ".join(guidance_lines),
    }
