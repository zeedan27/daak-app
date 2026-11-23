# Daak v2 — Findings, Constraints & Layer Decision Table

## 1. Local Environment (Verified Phase 0)
- **OS / Shell:** Windows (`pwsh`)
- **Git:** `git version 2.52.0.windows.1` (author configured: `Zesrab Tanjeel Khan <ztkhan000@gmail.com>`)
- **Node / npm:** `v26.13.0` / `11.20.0`
- **Python / uv:** `Python 3.14.2` / `uv 0.13.7`

## 2. Legacy Reference Notes (`D:\Projects\Daak\daak_final\Daak-main`)
Kept strictly read-only as a domain reference:
- Next.js 16 (JS-only) + Firebase/Firestore inline calls inside UI components.
- Domain modules worth referencing and redesigning cleanly in Phase 3: `safetyScore.js` (40/35/25 weighting), `falseReportDetection.js` (5-factor suspicion scoring), `chatbot.js` (location regex + safety prompt), `criminalDatabase.js`, `crimeAlerts.js`, Leaflet heatmap integration, and branding assets (`logo.png`, `daak-bg.png`).

## 3. Confirmed Discovery & Design Decisions (Phase 1)
- **Selected Tier:** `T1-Lite (Portfolio Production)` — real Supabase Auth, strict PostGIS RLS, FastAPI Pydantic validation, automated tests, free-tier hosting, and 1-click Demo Role Accounts (`Demo Citizen`, `Demo Police`, `Demo Admin`).
- **Creative Feature Additions:**
  1. **Safe Walk / Escort Timer** (missed check-in auto-escalates to `distress_signals`).
  2. **Community Corroboration ("I Saw This Too")** (PostGIS `<= 1 km` server check).
  3. **Bangla/Banglish-Aware DaakAI + Nearest Thana Lookup**.
  4. **Police Dispatch Live SLA Chronometer & Shift Handovers**.
- **Language & Identity:** English UI + Bangla/Banglish area/Thana & AI support; authenticated reporting with optional public anonymity (`is_anonymous_public` masked via `security_invoker` views).
- **Demo Surfaces:** Android `.apk` (EAS Build) + **Expo Web Preview** (so browser evaluators can test Citizen SOS live alongside the Next.js Police/Admin portal). External 999 telephony/SMS actions are simulated cleanly in demo mode.
- **Visual Direction:** Authorized override via `frontend-design` + `impeccable` (`concept-seed` reference `seed:4d73b1a176a6c703`) → **"Dhaka Civic Dispatch & Municipal Enamel"** documented in `DESIGN.md`.

## 4. Tooling & Skill Verification Inventory
- **Installed Core / UI / Stack Skills (14 active total — within S.C.O.P.E. limit):**
  - *Core (5):* `scope`, `verification-before-completion`, `systematic-debugging`, `test-driven-development`, `requesting-code-review`
  - *UI (5):* `design-taste-frontend`, `frontend-design`, `impeccable`, `web-design-guidelines`, `vercel-react-best-practices`
  - *Stack / Platform Packs (4):* `supabase`, `supabase-postgres-best-practices`, `workers-best-practices`, `wrangler`
- **Installed MCP Servers:** `context7`, `supabase_mcp`, `cloudflare_cloudflare`.

### Planned Skills & MCPs by Phase (Phases 2–5)
| Phase | Planned Skills / References / MCPs |
|---|---|
| **Phase 2 (Connections)** | `scope/references/config-templates.md`, `supabase`, `context7` MCP, `supabase_mcp` (dev project only) |
| **Phase 3 (Organization)** | `scope/references/stack-matrix.md`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `context7` MCP |
| **Phase 4 (Polish)** | `impeccable`, `web-design-guidelines`, `vercel-react-best-practices`, `/browser` |
| **Phase 5 (Execution)** | `scope/references/caching-and-scaling.md`, `scope/references/skills-and-safety.md` (Deploy Rule), `requesting-code-review`, Vercel/Render Git integration, `/browser`, `/learn` |

*(No extra Platform Pack installs required unless Render MCP or Upstash Redis is later promoted from Deferred.)*

## 5. 12-Layer Decision Table (`T1-Lite`)

| Layer | Status | Selected Tech | Rationale | Revisit Trigger |
|---|---|---|---|---|
| **1. Frontend** | **Required** | Expo (React Native + TypeScript + Expo Web Preview) for Citizens (`apps/mobile`); Next.js App Router + TypeScript for Police/Admin (`apps/web`); `DESIGN.md` tokens | Separates mobile-first citizen emergency UX from desktop dispatch/moderation while allowing browser reviewers to test both surfaces | Native iOS App Store release → add Apple Developer signing & native background location task |
| **2. APIs & Backend** | **Required** | Python FastAPI + Pydantic v2 (`apps/api`) | Deterministic safety scoring, 5-factor false-report heuristics, 1 km PostGIS corroboration, SLA state machine, and Bangla/Banglish DaakAI | `> 200 req/s` sustained or heavy async media processing → split background jobs to worker queue |
| **3. Database & Storage** | **Required** | Supabase PostgreSQL + PostGIS + `pg_trgm` + Supabase Storage (`evidence-media`, `criminal-photos`) | Native `geography(Point, 4326)` spatial queries (`ST_DWithin`), trigram Thana search, private signed media URLs, ordered SQL migrations | Exceeding Supabase free 500 MB DB / 1 GB Storage → upgrade to Supabase Pro + automated daily PITR backups |
| **4. Auth & Permissions** | **Required** | Supabase Auth (JWT) + `profiles.role` (`citizen`, `police`, `admin`) + 1-click Demo Role Accounts | Standard email/password + verified JWT claims; fast evaluation via seeded demo logins | Public production launch → disable 1-click demo buttons via `DEMO_MODE=false` & enforce OTP/NID verification |
| **5. Hosting & Deployment** | **Required** | Vercel Hobby (`apps/web`), Northflank Sandbox (`apps/api` via `Dockerfile`, always-on) with Render Free (`render.yaml`) fallback, Expo EAS Build `.apk` + Web Preview (`apps/mobile`), Supabase Cloud (`ap-south-1`) | Zero-cost public demo via Git root-directory/Dockerfile builds following S.C.O.P.E. Deploy Rule, avoiding cold starts on live demos | Sandbox compute allowance exceeded or Render fallback cold starts hit → upgrade Northflank PAYG / Render Starter |
| **6. Cloud & Compute** | **Lite** | Free-tier managed runtimes (Vercel Hobby, Northflank Sandbox `nf-compute-20`/`50` or Render Free fallback, Supabase Free) with `/healthz/live` & `/healthz/ready` | Keeps portfolio cost at \$0 while maintaining clean container/health-probe boundaries | Sustained traffic or monthly compute cap approached → set billing caps & right-sized instances |
| **7. CI/CD & Version Control** | **Required** | GitHub + GitHub Actions CI (`ci.yml`: typecheck, lint, `pytest`, Next build) | Enforces green automated checks before merge without paid CI minutes bloat | Multi-engineer release cadence → add required branch protection + staging auto-deploy gates |
| **8. Security & RLS** | **Required** | Default-deny RLS on all 10 tables, `security_invoker` views for public anonymity, role-lock triggers, private Storage buckets, gitleaks check | Prevents horizontal/vertical privilege leaks and protects anonymous citizen identities | Pre-public civic launch → external penetration test & automated SAST/DAST in CI |
| **9. Rate Limiting** | **Lite** | FastAPI per-IP/user sliding-window limiter on `/api/v1/ai/chat`, `/api/v1/sos`, and `/api/v1/reports` (in-memory/Upstash-ready interface) | Protects free-tier LLM quota and SOS endpoints from accidental demo spam or abuse | Multi-instance FastAPI scaling or `> 300 req/min` → plug in Upstash Redis (`upstash-ratelimit`) |
| **10. Caching & CDN** | **Lite** | Vercel Edge CDN for static web assets; short `Cache-Control` / `ETag` or 30s TTL on read-heavy `/safety-score` & `/heatmap` | Reduces PostGIS recomputation on repeated map pans without risking stale live SOS alerts | High map read volume → add Redis (`redis-best-practices`) spatial tile cache |
| **11. Load Balancing & Scaling** | **Deferred** | Platform-managed single-instance routing (Vercel + Northflank Sandbox / Render fallback) | Free-tier single-service scale fits portfolio/demo concurrency; FastAPI stays stateless | Concurrent active dispatch rooms `> 500` → enable horizontal FastAPI replicas + PgBouncer pooler |
| **12. Error Tracking & Logs** | **Lite** | Structured JSON logging in FastAPI (with `request_id` & PII/secret redaction) + `activity_logs` + `progress.md` | Fast root-cause debugging without mandatory paid APM spend; optional Sentry DSN hook if provided | Live citizen pilot launch → enable Sentry error routing & uptime webhook alerts |

## 6. Threat Model Sketch (`T1-Lite`)

### Critical Assets
1. **Citizen Reporter Identities** (especially `is_anonymous_public = true` whistleblowers).
2. **Role Authority Boundaries** (`citizen` vs. `police` vs. `admin` privileges).
3. **Live SOS Dispatch Stream & Evidence Media** (`distress_signals`, `evidence-media` bucket).
4. **LLM & Free-Tier Compute Quota** (`AI_PROVIDER_API_KEY`, Supabase/Render quotas).

### Threat Vectors & Concrete Mitigations
| Threat Vector | Impact | Mitigation |
|---|---|---|
| **Deanonymization of anonymous reporters** | Public feed exposes `reporter_id` or `author_id` | Public feeds query `public_reports_view` / `public_tips_view` (`WITH (security_invoker = true)`), stripping `reporter_id` and returning `'Anonymous Citizen'` whenever `is_anonymous_public = true` for non-staff viewers. |
| **Privilege escalation (`citizen` → `police`/`admin`)** | Unauthorized SOS dispatch, report deletion, watchlist tampering | Signup trigger hardcodes `role = 'citizen'`; RLS `WITH CHECK` & `BEFORE UPDATE` trigger block client modifications to `role`, `credibility_score`, and `is_verified`; FastAPI re-verifies role from DB on every privileged route. |
| **GPS spoofing on 1 km Corroboration ("I Saw This Too")** | Coordinated fake corroborations artificially verify false reports | Server-side PostGIS `ST_DWithin <= 1000m`, `UNIQUE(report_id, user_id)`, self-corroboration forbidden, plus account credibility weighting & rate limit. |
| **SOS spam / DoS flooding Police monitor** | Real emergencies buried in fake SOS alerts | Rate-limited `POST /api/v1/sos`, client 5-sec cancel ring, officer `"Mark False Alarm"` action reducing user credibility score and logging to `activity_logs`. |
| **Prompt injection & LLM quota drain on DaakAI** | System prompt leak or API key exhaustion | System prompt isolates retrieved report snippets as untrusted data; strict input length limit (`<= 500` chars), per-user rate limit on `/api/v1/ai/chat`, server-only `AI_PROVIDER_API_KEY`. |
| **Private evidence photo/video leakage** | Unauthorized public download of crime scene media | `evidence-media` bucket is private; uploaded strictly under `{auth.uid()}/*`; accessed only via short-lived signed URLs for owner, `police`, or `admin`. |
| **Secret leakage in Expo/Next client bundles** | Compromised `service_role` or AI keys | Strict `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` allowlist (only Supabase URL, Anon Key, and API Base URL); `.env*` gitignored; pre-Gate 2 secret scan. |

## 7. Phase 2 Connectivity & Handshake Facts
- **Supabase Cloud Project:** `daak-v2` (ID/ref: `ygdatgpfjephccykqqsc`, org: `xzhosimoxzsrjmrnbmsj`, region: `ap-south-1`, status: `ACTIVE_HEALTHY`, Postgres `17.12`, PostGIS `3.3.7`).
- **Supabase API URL:** `https://ygdatgpfjephccykqqsc.supabase.co` (keys kept out of committed files; passed via env vars).
- **Verified Handshakes:**
  - `postgis` + `pg_trgm` active; `ST_Distance` between Dhanmondi (`90.3742, 23.7461`) and TSC (`90.3954, 23.7324`) returned `2640.88` meters.
  - Supabase Auth (`/auth/v1/health` + `/auth/v1/settings`) HTTP `200` with publishable key; PostgREST OpenAPI root (`/rest/v1/`) confirmed locked (`HTTP 401` without `service_role`).
  - `context7` MCP resolved `@supabase/supabase-js` (`/supabase/supabase-js`).
  - `tools/verify_connections.py` passed in live, `--ci`, and `--quick` modes (hygiene, YAML `trigger: glob` frontmatter, structured JSON log secret redaction, Bangla/Banglish DaakAI deterministic fallback, Git + `.github/workflows/ci.yml`).
- **Phase 3 Advisor Note:** `get_advisors(security)` noted `postgis` and `pg_trgm` in `public` (`spatial_ref_sys` RLS / `extension_in_public`). Address in Phase 3's initial SQL migration (`extensions` schema or explicit `REVOKE` on `spatial_ref_sys`).
- **Remote Git Origin & CI:** Connected `origin` to public GitHub repo `https://github.com/zeedan27/daak-app` (`main`), and GitHub Actions CI (`runs/45233041942`) passed all 3 jobs (`Secret Scan (gitleaks)`, `Hygiene, Schema & FastAPI Pytest`, `Typecheck, Unit Tests & Next.js Build`).
