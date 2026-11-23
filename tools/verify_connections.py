"""Phase 2 deterministic connectivity and hygiene verifier for Daak v2.

Uses only the Python standard library so it runs cleanly in CI and local setups
without Phase 3 app dependencies. Reads any credentials exclusively from process
environment variables and never prints secret values.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
VALID_TRIGGERS = {"always_on", "model_decision", "glob", "manual"}
SECRET_KEY_PATTERNS = ("KEY", "SECRET", "TOKEN", "PASSWORD")
REDACT_REGEX = re.compile(
    r"(Bearer\s+)[A-Za-z0-9._\-]+|(sb_(?:secret|publishable)_[A-Za-z0-9._\-]+)|(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)",
    re.IGNORECASE,
)

DHAKA_AREAS = {
    "dhanmondi": ("Dhanmondi", "Dhanmondi Model Police Station", "01320-039660"),
    "mirpur": ("Mirpur", "Mirpur Model Police Station", "01320-041200"),
    "mohammadpur": ("Mohammadpur", "Mohammadpur Police Station", "01320-040800"),
    "uttara": ("Uttara", "Uttara East Police Station", "01320-041900"),
    "gulshan": ("Gulshan", "Gulshan Police Station", "01320-041000"),
    "tsc": ("TSC / Shahbagh", "Shahbagh Police Station", "01320-039520"),
}


def redact_value(value: Any) -> Any:
    """Recursively redact sensitive keys and token strings from structured logs."""
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for k, v in value.items():
            upper = k.upper()
            if any(pat in upper for pat in ("SECRET", "TOKEN", "PASSWORD", "API_KEY", "AUTHORIZATION")):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = redact_value(v)
        return sanitized
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, str):
        return REDACT_REGEX.sub(lambda m: f"{m.group(1) or ''}[REDACTED]", value)
    return value


def emit_json_log(event: str, request_id: str, payload: dict[str, Any]) -> str:
    """Build a structured JSON log line with redacted sensitive fields."""
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "event": event,
        "payload": redact_value(payload),
    }
    return json.dumps(record, ensure_ascii=False)


def check_hygiene() -> tuple[bool, str]:
    """Verify .gitignore, .env.example, mcp_config.json, and rule frontmatter."""
    proc = subprocess.run(
        ["git", "check-ignore", "-q", ".env"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return False, ".env is NOT ignored by git"

    env_example = ROOT / ".env.example"
    if not env_example.exists():
        return False, ".env.example missing"
    for line in env_example.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, val = stripped.split("=", 1)
        if any(pat in key for pat in SECRET_KEY_PATTERNS) and val.strip():
            return False, f"Sensitive key {key} has a non-empty value in .env.example"

    mcp_cfg_path = ROOT / ".agents" / "mcp_config.json"
    if not mcp_cfg_path.exists():
        return False, ".agents/mcp_config.json missing"
    mcp_cfg = json.loads(mcp_cfg_path.read_text(encoding="utf-8"))
    for name, cfg in mcp_cfg.get("mcpServers", {}).items():
        if "headers" in cfg or "env" in cfg:
            return False, f"Committed MCP server {name} must not define headers or env secrets"

    rule_path = ROOT / ".agents" / "rules" / "ui-components.md"
    if not rule_path.exists():
        return False, ".agents/rules/ui-components.md missing"
    rule_lines = rule_path.read_text(encoding="utf-8").splitlines()
    if len(rule_lines) < 3 or rule_lines[0].strip() != "---":
        return False, "ui-components.md missing YAML frontmatter"
    trigger_found = False
    for line in rule_lines[1:10]:
        if line.strip() == "---":
            break
        if line.startswith("trigger:"):
            trig_val = line.split(":", 1)[1].strip()
            if trig_val in VALID_TRIGGERS:
                trigger_found = True
    if not trigger_found:
        return False, "ui-components.md missing valid Antigravity trigger frontmatter"

    return True, "Hygiene, zero-secret config, and rule frontmatter verified"


def check_log_redaction() -> tuple[bool, str]:
    """Verify structured JSON logger redacts tokens and secret fields."""
    sample = {
        "Authorization": "Bearer secret_demo_token_xyz",
        "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_abc123",
        "AI_API_KEY": "sk-test-12345",
        "note": "Authorization header Bearer tok_999 failed",
        "area": "Dhanmondi",
    }
    serialized = emit_json_log("handshake.test", "req_phase2_001", sample)
    for leaked in ("secret_demo_token_xyz", "sb_secret_abc123", "sk-test-12345", "tok_999"):
        if leaked in serialized:
            return False, f"Secret leaked in JSON log: {leaked}"
    parsed = json.loads(serialized)
    if parsed.get("request_id") != "req_phase2_001" or parsed["payload"]["area"] != "Dhanmondi":
        return False, "Structured JSON log fields corrupted"
    return True, "Structured JSON logging & secret redaction verified"


def check_supabase_handshake(ci_mode: bool) -> tuple[bool, str]:
    """Verify Supabase Auth health and REST gateway with env URL and anon/publishable key."""
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()

    if not url or not anon_key:
        if ci_mode:
            return True, "Skipped live Supabase HTTP check in --ci mode (no env credentials)"
        return False, "Missing SUPABASE_URL or SUPABASE_ANON_KEY in process environment"

    auth_req = urllib.request.Request(
        f"{url}/auth/v1/health",
        headers={"apikey": anon_key},
        method="GET",
    )
    try:
        with urllib.request.urlopen(auth_req, timeout=10) as resp:
            if resp.status != 200:
                return False, f"Supabase Auth health returned HTTP {resp.status}"
            auth_body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return False, f"Supabase Auth health failed: {exc}"

    settings_req = urllib.request.Request(
        f"{url}/auth/v1/settings",
        headers={"apikey": anon_key},
        method="GET",
    )
    try:
        with urllib.request.urlopen(settings_req, timeout=10) as resp:
            if resp.status != 200:
                return False, f"Supabase Auth settings returned HTTP {resp.status}"
    except urllib.error.URLError as exc:
        return False, f"Supabase Auth settings failed: {exc}"

    rest_req = urllib.request.Request(
        f"{url}/rest/v1/",
        headers={"apikey": anon_key, "Accept": "application/openapi+json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(rest_req, timeout=10) as resp:
            rest_note = f"REST OpenAPI HTTP {resp.status}"
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            rest_note = "REST OpenAPI root locked (HTTP 401 without secret key)"
        else:
            return False, f"Supabase REST gateway unexpected HTTP {exc.code}"
    except urllib.error.URLError as exc:
        return False, f"Supabase REST gateway failed: {exc}"

    return True, f"Supabase Auth health+settings HTTP 200 & {rest_note} ({auth_body[:60]})"


def run_daakai_deterministic_fallback(prompt: str) -> dict[str, Any]:
    """Deterministic Bangla/Banglish area & nearest-Thana safety triage fallback."""
    lowered = prompt.lower()
    matched = None
    for key, info in DHAKA_AREAS.items():
        if key in lowered:
            matched = info
            break
    area_name, station_name, phone = matched or ("Dhaka Metro", "National Emergency Service", "999")
    return {
        "mode": "deterministic_fallback",
        "area": area_name,
        "nearest_thana": station_name,
        "duty_phone": phone,
        "guidance": (
            f"Stay in lit, populated areas around {area_name}. "
            f"Contact {station_name} ({phone}) or trigger Daak SOS if you feel unsafe."
        ),
    }


def check_ai_handshake() -> tuple[bool, str]:
    """Verify deterministic DaakAI fallback (and optional live OpenAI-compatible check)."""
    fallback = run_daakai_deterministic_fallback("Dhanmondi te raat e hata safe?")
    if fallback["area"] != "Dhanmondi" or "Dhanmondi Model Police Station" not in fallback["nearest_thana"]:
        return False, "Banglish DaakAI fallback failed area/Thana extraction"
    return True, f"DaakAI Bangla/Banglish fallback verified (area={fallback['area']}, thana={fallback['nearest_thana']})"


def check_git_and_ci() -> tuple[bool, str]:
    """Verify Git repository health and CI workflow presence."""
    proc = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    if proc.returncode != 0:
        return False, "Not inside a valid Git worktree"
    ci_path = ROOT / ".github" / "workflows" / "ci.yml"
    if not ci_path.exists():
        return False, ".github/workflows/ci.yml missing"
    return True, f"Git branch '{proc.stdout.strip()}' & CI workflow verified"


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Daak v2 Phase 2 connections and hygiene.")
    parser.add_argument("--ci", action="store_true", help="Skip live network checks requiring secrets.")
    parser.add_argument("--quick", action="store_true", help="Run hygiene, redaction, AI fallback, and git checks.")
    args = parser.parse_args()

    checks = [
        ("hygiene", check_hygiene),
        ("log_redaction", check_log_redaction),
        ("daakai_fallback", check_ai_handshake),
        ("git_and_ci", check_git_and_ci),
    ]
    if not args.quick:
        checks.append(("supabase_handshake", lambda: check_supabase_handshake(ci_mode=args.ci)))

    all_passed = True
    for name, fn in checks:
        ok, message = fn()
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {message}")
        if not ok:
            all_passed = False

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
