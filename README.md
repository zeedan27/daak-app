# Daak v2 — Bangladesh Civic Dispatch & Safety Platform

**Daak v2** (*"Daak"* — Bengali for *a call for help*) is a dual-surface emergency dispatch, PostGIS crime-intelligence, and community safety platform built for Bangladesh under the **S.C.O.P.E.** engineering framework (`T1-Lite` portfolio production tier).

> **Demo Data Notice:** Seeded incidents, Thana contacts, criminal watchlist entries, and 999 dispatch relays are **synthetic Bangladesh demonstration records** for safe end-to-end evaluation.

---

## Architecture & Surfaces

| Surface | Path | Stack | Purpose |
|---|---|---|---|
| **Police & Admin Desktop + Citizen Preview** | `apps/web` | Next.js 16 (App Router, React 19, TypeScript) | 3-zone dispatch command desk, live `MM:SS` SLA chronometers, PostGIS spatial map, 5-factor false-report triage, criminal watchlist CRUD, shift handovers, and embedded `390×844` Citizen Expo Web Preview |
| **Citizen Mobile App** | `apps/mobile` | Expo (React Native, TypeScript) | Tactile 5s cancelable SOS ring, Safe Walk auto-escalation timer, 1 km community corroboration, anonymous incident reporting, and Bangla/Banglish DaakAI |
| **Domain API** | `apps/api` | Python 3.12+ / FastAPI / Pydantic v2 | Deterministic safety scoring (`40/35/25`), 5-factor false-report scoring, PostGIS 1 km corroboration, SLA state machine, rate limiting, and `/healthz/live` + `/healthz/ready` probes |
| **Database, Auth & Storage** | `supabase/migrations` | Supabase PostgreSQL + PostGIS + `pg_trgm` | 10 spatial/relational tables, default-deny RLS, `security_invoker` anonymity views (`public_reports_view`, `public_tips_view`), role-escalation triggers, and private storage buckets |

---

## Creative & Safety Capabilities
1. **Tactile 5-Second Cancelable SOS + Safe Walk Auto-Escalation:** Prevents accidental triggers while auto-escalating missed Safe Walk check-ins into live Police SOS signals.
2. **1 km Community Corroboration ("I Saw This Too"):** Server-side PostGIS `ST_DWithin <= 1000m` witness verification that boosts report trust and lowers false-report suspicion.
3. **Bangla / Banglish DaakAI + Nearest Thana Lookup:** Grounded safety guidance and station phone lookup across Dhaka Metro and Chattogram (`pg_trgm` + deterministic fallback).
4. **Public Anonymity With Internal Accountability:** `is_anonymous_public = true` masks `reporter_id` and displays `"Anonymous Citizen"` to public viewers while preserving staff accountability for moderation and anti-abuse.
5. **1-Click Demo Role Switcher (`DEMO_MODE=true`):** Instant evaluation across `Demo Police (SI Tariqul)`, `Demo Admin (Farhana)`, and `Demo Citizen (Nadia)`.

---

## Local Setup & Verification

### Prerequisites
- Node.js `22+` / npm `10+`
- Python `3.12+` / `uv`

### Run Locally
```bash
# 1. Install web dependencies
npm --prefix apps/web ci

# 2. Run FastAPI domain API (http://localhost:8000)
uv run --directory apps/api uvicorn app.main:app --host 127.0.0.1 --port 8000 --timeout-keep-alive 65

# 3. Run Next.js Desktop Portal + Citizen Preview (http://localhost:3000)
npm run dev:web
```

### Verification Suite
```bash
# Backend unit & integration tests (20 tests)
uv run --directory apps/api pytest -v

# Frontend & mobile logic unit tests (13 tests)
npm test

# TypeScript check, production Next.js build, and connection/schema hygiene
npm run typecheck
npm run build
npm run lint

# Dependency & secret hygiene
npm --prefix apps/web audit
gitleaks git --no-banner --redact
```

---

## Deployment (Git-Based — S.C.O.P.E. Deploy Rule)
Deployment manifests and full operational runbooks live in [architecture/maintenance.md](architecture/maintenance.md):
- **FastAPI (`apps/api`):** Primary **Northflank Sandbox** always-on container via [apps/api/Dockerfile](apps/api/Dockerfile) + [apps/api/.dockerignore](apps/api/.dockerignore), with **Render Free Blueprint** via [render.yaml](render.yaml) kept as zero-card fallback (`/healthz/ready`, `--timeout-keep-alive 65`)
- **Desktop Web (`apps/web`):** **Vercel Hobby** Next.js project (`Root Directory: apps/web`) using [apps/web/vercel.json](apps/web/vercel.json) and [apps/web/.vercelignore](apps/web/.vercelignore)
- **Citizen Android APK (`apps/mobile`):** Expo EAS Build `preview` profile via [apps/mobile/eas.json](apps/mobile/eas.json)
- **CI Pipeline:** [.github/workflows/ci.yml](.github/workflows/ci.yml) (`gitleaks`, schema/hygiene checks, `pytest`, `npm test`, `typecheck`, `build`)
