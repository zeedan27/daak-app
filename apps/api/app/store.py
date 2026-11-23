"""State store for Daak v2 seeded with the Bangladesh synthetic demo dataset."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


def _iso_ago(**kwargs: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(**kwargs)).isoformat()


def _iso_ahead(**kwargs: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(**kwargs)).isoformat()


class InMemoryDaakStore:
    """Thread-safe-enough single-process store mirroring the Supabase schema for fast API & demo execution."""

    def __init__(self) -> None:
        self.profiles: dict[str, dict[str, Any]] = {
            "11111111-1111-4111-8111-111111111101": {
                "id": "11111111-1111-4111-8111-111111111101",
                "email": "demo.citizen@daak.bd",
                "full_name": "Nadia Rahman",
                "phone": "+8801711000101",
                "role": "citizen",
                "station_id": None,
                "credibility_score": 88,
                "is_verified": True,
                "is_demo_account": True,
            },
            "11111111-1111-4111-8111-111111111102": {
                "id": "11111111-1111-4111-8111-111111111102",
                "email": "demo.police@daak.bd",
                "full_name": "SI Tariqul Islam",
                "phone": "+8801711000102",
                "role": "police",
                "station_id": "22222222-2222-4222-8222-222222222201",
                "credibility_score": 98,
                "is_verified": True,
                "is_demo_account": True,
            },
            "11111111-1111-4111-8111-111111111103": {
                "id": "11111111-1111-4111-8111-111111111103",
                "email": "demo.admin@daak.bd",
                "full_name": "Farhana Karim (Admin)",
                "phone": "+8801711000103",
                "role": "admin",
                "station_id": None,
                "credibility_score": 100,
                "is_verified": True,
                "is_demo_account": True,
            },
        }
        self.demo_tokens: dict[str, str] = {
            "demo-citizen-token": "11111111-1111-4111-8111-111111111101",
            "demo-police-token": "11111111-1111-4111-8111-111111111102",
            "demo-admin-token": "11111111-1111-4111-8111-111111111103",
        }

        self.police_stations: list[dict[str, Any]] = [
            {
                "id": "22222222-2222-4222-8222-222222222201",
                "name_en": "Dhanmondi Model Police Station",
                "name_bn": "ধানমন্ডি মডেল থানা",
                "aliases": ["dhanmondi", "kalabagan", "science lab", "jigatola", "ধানমন্ডি"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320039660",
                "lat": 23.7461,
                "lng": 90.3742,
            },
            {
                "id": "22222222-2222-4222-8222-222222222202",
                "name_en": "Shahbagh Police Station",
                "name_bn": "শাহবাগ থানা",
                "aliases": ["shahbagh", "tsc", "dhaka university", "ramna", "শাহবাগ"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320039520",
                "lat": 23.7385,
                "lng": 90.3954,
            },
            {
                "id": "22222222-2222-4222-8222-222222222203",
                "name_en": "Mohammadpur Police Station",
                "name_bn": "মোহাম্মদপুর থানা",
                "aliases": ["mohammadpur", "bosila", "adabor", "lalmatia", "মোহাম্মদপুর"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320040800",
                "lat": 23.7654,
                "lng": 90.3587,
            },
            {
                "id": "22222222-2222-4222-8222-222222222204",
                "name_en": "Mirpur Model Police Station",
                "name_bn": "মিরপুর মডেল থানা",
                "aliases": ["mirpur", "mirpur-10", "mirpur 10", "kazipara", "shewrapara", "মিরপুর"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320041200",
                "lat": 23.8069,
                "lng": 90.3688,
            },
            {
                "id": "22222222-2222-4222-8222-222222222205",
                "name_en": "Gulshan Police Station",
                "name_bn": "গুলশান থানা",
                "aliases": ["gulshan", "gulshan-2", "banani", "baridhara", "গুলশান"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320041000",
                "lat": 23.7925,
                "lng": 90.4152,
            },
            {
                "id": "22222222-2222-4222-8222-222222222206",
                "name_en": "Uttara East Police Station",
                "name_bn": "উত্তরা পূর্ব থানা",
                "aliases": ["uttara", "uttara-7", "azampur", "airport", "উত্তরা"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320041900",
                "lat": 23.8759,
                "lng": 90.4005,
            },
            {
                "id": "22222222-2222-4222-8222-222222222207",
                "name_en": "Motijheel Police Station",
                "name_bn": "মতিঝিল থানা",
                "aliases": ["motijheel", "dilkusha", "kamalapur", "paltan", "মতিঝিল"],
                "district": "Dhaka",
                "division": "Dhaka",
                "phone": "+8801320039740",
                "lat": 23.7330,
                "lng": 90.4173,
            },
            {
                "id": "22222222-2222-4222-8222-222222222208",
                "name_en": "Kotwali Police Station, Chattogram",
                "name_bn": "কোতোয়ালী থানা, চট্টগ্রাম",
                "aliases": ["chattogram", "chittagong", "kotwali", "agrabad", "চট্টগ্রাম"],
                "district": "Chattogram",
                "division": "Chattogram",
                "phone": "+8801320053100",
                "lat": 22.3384,
                "lng": 91.8339,
            },
        ]

        self.reports: list[dict[str, Any]] = [
            {
                "id": "33333333-3333-4333-8333-333333333301",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": True,
                "category": "snatching",
                "severity": "high",
                "title": "Phone snatching near Kalabagan footover bridge",
                "description": "Two riders on a dark motorcycle snatched a commuter phone near the east stair exit and sped toward Science Lab.",
                "area_name": "Dhanmondi",
                "address_text": "Kalabagan Bus Stand, Mirpur Road",
                "lat": 23.7495,
                "lng": 90.3806,
                "occurred_at": _iso_ago(minutes=35),
                "created_at": _iso_ago(minutes=35),
                "status": "verified",
                "corroboration_count": 2,
                "suspicion_score": 8,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": None,
            },
            {
                "id": "33333333-3333-4333-8333-333333333302",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "traffic_hazard",
                "severity": "medium",
                "title": "Streetlights out along Dhanmondi Road 27 north lane",
                "description": "Three consecutive lamp posts are dark near the lake turnoff creating blind spots for pedestrians at night.",
                "area_name": "Dhanmondi",
                "address_text": "Road 27, Dhanmondi",
                "lat": 23.7512,
                "lng": 90.3735,
                "occurred_at": _iso_ago(hours=3),
                "created_at": _iso_ago(hours=3),
                "status": "resolved",
                "corroboration_count": 1,
                "suspicion_score": 5,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": "DNCC electrical crew dispatched",
            },
            {
                "id": "33333333-3333-4333-8333-333333333303",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": True,
                "category": "harassment",
                "severity": "high",
                "title": "Repeated evening harassment outside Mirpur-10 metro exit",
                "description": "Group blocking the footpath near Gate B harassing students returning from coaching after 20:00.",
                "area_name": "Mirpur-10",
                "address_text": "Metro Rail Station Gate B, Mirpur-10",
                "lat": 23.8072,
                "lng": 90.3690,
                "occurred_at": _iso_ago(hours=2),
                "created_at": _iso_ago(hours=2),
                "status": "investigating",
                "corroboration_count": 3,
                "suspicion_score": 10,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": "Evening patrol assigned",
            },
            {
                "id": "33333333-3333-4333-8333-333333333304",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "theft",
                "severity": "medium",
                "title": "Locked bicycle stolen outside TSC library rack",
                "description": "Cable lock cut between 18:30 and 19:15 near the Dhaka University TSC south gate.",
                "area_name": "Shahbagh",
                "address_text": "TSC South Gate, Dhaka University",
                "lat": 23.7329,
                "lng": 90.3958,
                "occurred_at": _iso_ago(days=1),
                "created_at": _iso_ago(days=1),
                "status": "resolved",
                "corroboration_count": 0,
                "suspicion_score": 12,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": None,
            },
            {
                "id": "33333333-3333-4333-8333-333333333305",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "fraud",
                "severity": "medium",
                "title": "Fake bKash agent kiosk targeting commuters at Uttara Azampur",
                "description": "Unlicensed mobile-money booth attempting PIN social engineering near Azampur footover.",
                "area_name": "Uttara",
                "address_text": "Azampur Bus Stop, Uttara Sector 7",
                "lat": 23.8686,
                "lng": 90.4008,
                "occurred_at": _iso_ago(hours=6),
                "created_at": _iso_ago(hours=6),
                "status": "verified",
                "corroboration_count": 1,
                "suspicion_score": 14,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": None,
            },
            {
                "id": "33333333-3333-4333-8333-333333333306",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "suspicious_activity",
                "severity": "low",
                "title": "Unattended bag reported near Gulshan-2 circle",
                "description": "Security patrol inspected and confirmed lost luggage returned to owner.",
                "area_name": "Gulshan",
                "address_text": "Gulshan-2 Circle South",
                "lat": 23.7945,
                "lng": 90.4148,
                "occurred_at": _iso_ago(days=2),
                "created_at": _iso_ago(days=2),
                "status": "resolved",
                "corroboration_count": 0,
                "suspicion_score": 6,
                "flag_status": "none",
                "suspicion_reasons": [],
                "moderation_note": None,
            },
            {
                "id": "33333333-3333-4333-8333-333333333307",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "vandalism",
                "severity": "low",
                "title": "Test spam report click link http://bit.ly/fake-promo",
                "description": "test test urgent free reward click link now",
                "area_name": "Mohammadpur",
                "address_text": "Town Hall Market",
                "lat": 23.7638,
                "lng": 90.3636,
                "occurred_at": _iso_ago(minutes=50),
                "created_at": _iso_ago(minutes=50),
                "status": "pending",
                "corroboration_count": 0,
                "suspicion_score": 84,
                "flag_status": "flagged",
                "suspicion_reasons": [
                    "Suspicious promotional link or test keyword detected",
                    "Short generic description",
                ],
                "moderation_note": None,
            },
            {
                "id": "33333333-3333-4333-8333-333333333308",
                "reporter_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": False,
                "category": "snatching",
                "severity": "high",
                "title": "Duplicate unverified snatching claim near Town Hall",
                "description": "Same incident copy pasted multiple times without clear landmark details.",
                "area_name": "Mohammadpur",
                "address_text": "Town Hall Corner",
                "lat": 23.7640,
                "lng": 90.3638,
                "occurred_at": _iso_ago(minutes=42),
                "created_at": _iso_ago(minutes=42),
                "status": "pending",
                "corroboration_count": 0,
                "suspicion_score": 72,
                "flag_status": "flagged",
                "suspicion_reasons": [
                    "Near-duplicate spatial and category report within 60 minutes",
                    "Rapid submission pattern",
                ],
                "moderation_note": None,
            },
        ]

        self.corroborations: list[dict[str, Any]] = [
            {
                "id": "44444444-4444-4444-8444-444444444401",
                "report_id": "33333333-3333-4333-8333-333333333301",
                "user_id": "11111111-1111-4111-8111-111111111102",
                "distance_meters": 98.5,
                "note": "Patrol unit confirmed eyewitness accounts at Kalabagan.",
                "created_at": _iso_ago(minutes=20),
            }
        ]

        self.tips: list[dict[str, Any]] = [
            {
                "id": "55555555-5555-4555-8555-555555555501",
                "report_id": "33333333-3333-4333-8333-333333333301",
                "author_id": "11111111-1111-4111-8111-111111111101",
                "is_anonymous_public": True,
                "body": "Bike had no rear license plate and headed toward Green Road.",
                "created_at": _iso_ago(minutes=18),
            },
            {
                "id": "55555555-5555-4555-8555-555555555502",
                "report_id": "33333333-3333-4333-8333-333333333303",
                "author_id": "11111111-1111-4111-8111-111111111102",
                "is_anonymous_public": False,
                "body": "Mirpur patrol team stationed at Gate B from 19:30 to 23:00.",
                "created_at": _iso_ago(minutes=15),
            },
        ]

        self.distress_signals: list[dict[str, Any]] = [
            {
                "id": "66666666-6666-4666-8666-666666666601",
                "user_id": "11111111-1111-4111-8111-111111111101",
                "citizen_name": "Nadia Rahman",
                "trigger_source": "panic_button",
                "lat": 23.8065,
                "lng": 90.3692,
                "area_name": "Mirpur-10",
                "battery_level": 34,
                "note": "Followed near metro pillar 254, need assistance.",
                "status": "active",
                "claimed_by": None,
                "assigned_unit": None,
                "triggered_at": _iso_ago(minutes=2, seconds=20),
                "claimed_at": None,
                "resolved_at": None,
                "sla_target_seconds": 300,
                "dispatch_timeline": [
                    {
                        "at": _iso_ago(minutes=2, seconds=20),
                        "status": "active",
                        "note": "Panic SOS triggered by citizen (Demo Simulated 999 Relay)",
                    }
                ],
            },
            {
                "id": "66666666-6666-4666-8666-666666666602",
                "user_id": "11111111-1111-4111-8111-111111111101",
                "citizen_name": "Nadia Rahman",
                "trigger_source": "panic_button",
                "lat": 23.7448,
                "lng": 90.3755,
                "area_name": "Dhanmondi",
                "battery_level": 61,
                "note": "Altercation outside shopping complex gate.",
                "status": "claimed",
                "claimed_by": "11111111-1111-4111-8111-111111111102",
                "assigned_unit": "Dhanmondi Patrol-04",
                "triggered_at": _iso_ago(minutes=6, seconds=15),
                "claimed_at": _iso_ago(minutes=4),
                "resolved_at": None,
                "sla_target_seconds": 300,
                "dispatch_timeline": [
                    {"at": _iso_ago(minutes=6, seconds=15), "status": "active", "note": "Panic SOS triggered"},
                    {
                        "at": _iso_ago(minutes=4),
                        "status": "claimed",
                        "note": "Claimed by SI Tariqul Islam — Dhanmondi Patrol-04 assigned",
                    },
                ],
            },
            {
                "id": "66666666-6666-4666-8666-666666666603",
                "user_id": "11111111-1111-4111-8111-111111111101",
                "citizen_name": "Nadia Rahman",
                "trigger_source": "safe_walk_timeout",
                "lat": 23.8721,
                "lng": 90.4012,
                "area_name": "Uttara Sector 7",
                "battery_level": 19,
                "note": "Safe Walk check-in missed past ETA.",
                "status": "responding",
                "claimed_by": "11111111-1111-4111-8111-111111111102",
                "assigned_unit": "Uttara Mobile-02",
                "triggered_at": _iso_ago(minutes=11, seconds=10),
                "claimed_at": _iso_ago(minutes=8),
                "resolved_at": None,
                "sla_target_seconds": 300,
                "dispatch_timeline": [
                    {"at": _iso_ago(minutes=11, seconds=10), "status": "active", "note": "Auto-escalated from Safe Walk timer"},
                    {"at": _iso_ago(minutes=8), "status": "responding", "note": "Uttara Mobile-02 en route"},
                ],
            },
        ]

        self.safe_walks: list[dict[str, Any]] = [
            {
                "id": "77777777-7777-4777-8777-777777777701",
                "user_id": "11111111-1111-4111-8111-111111111101",
                "destination_name": "TSC, Dhaka University",
                "lat": 23.7420,
                "lng": 90.3821,
                "destination_lat": 23.7324,
                "destination_lng": 90.3954,
                "expected_arrival_at": _iso_ahead(minutes=18),
                "status": "active",
                "escalated_sos_id": None,
                "created_at": _iso_ago(minutes=5),
            }
        ]

        self.shift_handovers: list[dict[str, Any]] = [
            {
                "id": "88888888-8888-4888-8888-888888888801",
                "outgoing_officer_id": "11111111-1111-4111-8111-111111111102",
                "officer_name": "SI Tariqul Islam",
                "station_id": "22222222-2222-4222-8222-222222222201",
                "shift_label": "Day -> Evening Shift (14:00–22:00)",
                "summary": "Increased motorcycle snatching reports around Kalabagan footover and Mirpur-10 Gate B. Keep Patrol-04 near Road 27.",
                "open_sos_ids": ["66666666-6666-4666-8666-666666666601", "66666666-6666-4666-8666-666666666602"],
                "priority_areas": ["Dhanmondi", "Mirpur-10", "Uttara"],
                "created_at": _iso_ago(hours=1),
            }
        ]

        self.criminals: list[dict[str, Any]] = [
            {
                "id": "99999999-9999-4999-8999-999999999901",
                "full_name": "Kamrul Hasan (Synthetic Demo)",
                "aliases": ["Kala Kamrul"],
                "crime_categories": ["snatching", "theft"],
                "risk_level": "high",
                "last_known_area": "Kalabagan / Dhanmondi",
                "status": "wanted",
                "details": "Synthetic demo watchlist entry linked to motorcycle snatching cluster near Mirpur Road.",
                "created_at": _iso_ago(days=4),
            },
            {
                "id": "99999999-9999-4999-8999-999999999902",
                "full_name": "Sajib Mia (Synthetic Demo)",
                "aliases": ["Sajib"],
                "crime_categories": ["fraud"],
                "risk_level": "medium",
                "last_known_area": "Uttara Azampur",
                "status": "wanted",
                "details": "Synthetic demo entry for mobile financial service impersonation.",
                "created_at": _iso_ago(days=3),
            },
            {
                "id": "99999999-9999-4999-8999-999999999903",
                "full_name": "Rashedul Alam (Synthetic Demo)",
                "aliases": ["Rashed"],
                "crime_categories": ["assault", "harassment"],
                "risk_level": "critical",
                "last_known_area": "Mirpur-10",
                "status": "in_custody",
                "details": "Synthetic demo entry — apprehended during Mirpur-10 patrol sweep.",
                "created_at": _iso_ago(days=2),
            },
        ]

        self.activity_logs: list[dict[str, Any]] = [
            {
                "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
                "actor_id": "11111111-1111-4111-8111-111111111102",
                "actor_role": "police",
                "action": "sos.claimed",
                "target_type": "distress_signals",
                "target_id": "66666666-6666-4666-8666-666666666602",
                "metadata": {"assigned_unit": "Dhanmondi Patrol-04"},
                "created_at": _iso_ago(minutes=4),
            },
            {
                "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
                "actor_id": "11111111-1111-4111-8111-111111111103",
                "actor_role": "admin",
                "action": "report.flagged",
                "target_type": "reports",
                "target_id": "33333333-3333-4333-8333-333333333307",
                "metadata": {"suspicion_score": 84},
                "created_at": _iso_ago(minutes=50),
            },
        ]

        self.sos_idempotency: dict[str, dict[str, Any]] = {}

    async def check_readiness(self) -> bool:
        """Verify store health."""
        return len(self.police_stations) > 0

    async def sync_insert(self, table: str, payload: dict[str, Any]) -> None:
        """No-op hook overridden by SupabaseDaakStore."""
        return None

    async def sync_update(self, table: str, record_id: str, payload: dict[str, Any]) -> None:
        """No-op hook overridden by SupabaseDaakStore."""
        return None

    async def sync_delete(self, table: str, record_id: str) -> None:
        """No-op hook overridden by SupabaseDaakStore."""
        return None

    async def resolve_user_from_token(self, token: str) -> dict[str, Any] | None:
        """Resolve user profile from demo token (when DEMO_MODE=true) or live Supabase Auth."""
        demo_enabled = os.environ.get("DEMO_MODE", "true").lower() == "true"
        if demo_enabled and token in self.demo_tokens:
            uid = self.demo_tokens[token]
            return self.profiles.get(uid)
        return None


class SupabaseDaakStore(InMemoryDaakStore):
    """Supabase PostgREST-backed store that persists mutations and resolves authoritative profiles."""

    def __init__(
        self,
        supabase_url: str,
        anon_key: str,
        service_role_key: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        super().__init__()
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = anon_key
        self.service_role_key = service_role_key
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=6.0, transport=self._transport)

    def _service_headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    async def check_readiness(self) -> bool:
        """Execute lightweight PostgREST probe against police_stations."""
        try:
            async with self._client() as client:
                resp = await client.get(
                    f"{self.supabase_url}/rest/v1/police_stations?select=id&limit=1",
                    headers=self._service_headers(),
                )
                return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def sync_insert(self, table: str, payload: dict[str, Any]) -> None:
        """Persist a newly created record to Supabase Postgres via PostgREST."""
        row = self._to_postgrest_payload(table, payload)
        try:
            async with self._client() as client:
                await client.post(
                    f"{self.supabase_url}/rest/v1/{table}",
                    headers=self._service_headers(),
                    json=row,
                )
        except httpx.HTTPError:
            pass

    async def sync_update(self, table: str, record_id: str, payload: dict[str, Any]) -> None:
        """Persist record field updates to Supabase Postgres via PostgREST."""
        row = self._to_postgrest_payload(table, payload)
        try:
            async with self._client() as client:
                await client.patch(
                    f"{self.supabase_url}/rest/v1/{table}?id=eq.{record_id}",
                    headers=self._service_headers(),
                    json=row,
                )
        except httpx.HTTPError:
            pass

    async def sync_delete(self, table: str, record_id: str) -> None:
        """Delete a record from Supabase Postgres via PostgREST."""
        try:
            async with self._client() as client:
                await client.delete(
                    f"{self.supabase_url}/rest/v1/{table}?id=eq.{record_id}",
                    headers=self._service_headers(),
                )
        except httpx.HTTPError:
            pass

    @staticmethod
    def _to_postgrest_payload(table: str, payload: dict[str, Any]) -> dict[str, Any]:
        row = dict(payload)
        lat = row.pop("lat", None)
        lng = row.pop("lng", None)
        if lat is not None and lng is not None:
            loc_col = "last_known_location" if table == "safe_walks" else "location"
            row[loc_col] = f"SRID=4326;POINT({lng} {lat})"
        dest_lat = row.pop("destination_lat", None)
        dest_lng = row.pop("destination_lng", None)
        if dest_lat is not None and dest_lng is not None:
            row["destination_location"] = f"SRID=4326;POINT({dest_lng} {dest_lat})"
        user_lat = row.pop("user_lat", None)
        user_lng = row.pop("user_lng", None)
        if user_lat is not None and user_lng is not None:
            row["user_location"] = f"SRID=4326;POINT({user_lng} {user_lat})"
        for transient in ("citizen_name", "nearest_thana", "officer_name"):
            row.pop(transient, None)
        return row

    async def resolve_user_from_token(self, token: str) -> dict[str, Any] | None:
        """Verify JWT via Supabase Auth and load authoritative role from public.profiles."""
        demo_profile = await super().resolve_user_from_token(token)
        if demo_profile is not None:
            return demo_profile

        try:
            async with self._client() as client:
                auth_resp = await client.get(
                    f"{self.supabase_url}/auth/v1/user",
                    headers={"apikey": self.anon_key, "Authorization": f"Bearer {token}"},
                )
                if auth_resp.status_code != 200:
                    return None
                uid = auth_resp.json().get("id")
                if not uid:
                    return None

                prof_resp = await client.get(
                    f"{self.supabase_url}/rest/v1/profiles?id=eq.{uid}&select=*",
                    headers=self._service_headers(),
                )
                if prof_resp.status_code == 200 and prof_resp.json():
                    profile = prof_resp.json()[0]
                    self.profiles[uid] = profile
                    return profile
                return self.profiles.get(uid)
        except httpx.HTTPError:
            return None


def create_default_store() -> InMemoryDaakStore:
    """Select SupabaseDaakStore when service credentials are configured, else InMemoryDaakStore."""
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and service_key:
        return SupabaseDaakStore(
            supabase_url=url,
            anon_key=anon_key or service_key,
            service_role_key=service_key,
        )
    return InMemoryDaakStore()
