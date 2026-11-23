"""Static schema, RLS, view, and seed invariant checker for Daak v2."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_SQL = ROOT / "supabase" / "migrations" / "20261123000100_init_daak_schema_and_rls.sql"
SEED_SQL = ROOT / "supabase" / "migrations" / "20261123000200_seed_bangladesh_demo_data.sql"

REQUIRED_TABLES = (
    "profiles",
    "police_stations",
    "reports",
    "report_corroborations",
    "report_tips",
    "distress_signals",
    "safe_walks",
    "shift_handovers",
    "criminals",
    "activity_logs",
)


def main() -> int:
    errors: list[str] = []

    if not SCHEMA_SQL.exists():
        errors.append(f"Missing schema migration: {SCHEMA_SQL}")
    if not SEED_SQL.exists():
        errors.append(f"Missing seed migration: {SEED_SQL}")
    if errors:
        for err in errors:
            print(f"[FAIL] {err}")
        return 1

    schema_text = SCHEMA_SQL.read_text(encoding="utf-8")
    seed_text = SEED_SQL.read_text(encoding="utf-8")

    for table in REQUIRED_TABLES:
        if not re.search(rf"CREATE TABLE\s+(?:IF NOT EXISTS\s+)?public\.{table}\b", schema_text, re.IGNORECASE):
            errors.append(f"Missing table definition: public.{table}")
        if not re.search(
            rf"ALTER TABLE\s+public\.{table}\s+ENABLE ROW LEVEL SECURITY",
            schema_text,
            re.IGNORECASE,
        ):
            errors.append(f"Missing ENABLE ROW LEVEL SECURITY for public.{table}")

    if re.search(r"\bauth\.role\s*\(", schema_text, re.IGNORECASE):
        errors.append("Deprecated auth.role() found in schema SQL")

    if "(select auth.uid())" not in schema_text.lower():
        errors.append("Missing cached (select auth.uid()) RLS pattern")

    for view_name in ("public_reports_view", "public_tips_view"):
        pattern = rf"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.{view_name}\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)"
        if not re.search(pattern, schema_text, re.IGNORECASE):
            errors.append(f"Missing security_invoker = true view: public.{view_name}")

    if "prevent_profile_privilege_escalation" not in schema_text:
        errors.append("Missing profile privilege escalation trigger")

    if "private.current_user_role()" not in schema_text:
        errors.append("Missing private.current_user_role() helper")

    for demo_email in ("demo.citizen@daak.bd", "demo.police@daak.bd", "demo.admin@daak.bd"):
        if demo_email not in seed_text:
            errors.append(f"Missing demo seed account: {demo_email}")

    for thana in ("Dhanmondi Model Police Station", "Mirpur Model Police Station", "Shahbagh Police Station"):
        if thana not in seed_text:
            errors.append(f"Missing Bangladesh Thana seed: {thana}")

    if errors:
        for err in errors:
            print(f"[FAIL] {err}")
        return 1

    print("[PASS] Schema, default-deny RLS, security_invoker views, triggers, and BD seed invariants verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
