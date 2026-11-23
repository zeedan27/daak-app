# Daak v2 — Architecture Decision Records (ADR Log)

## ADR Template
```markdown
### ADR-NNN: <Title>
- **Status:** Proposed | Accepted | Superseded
- **Date:** YYYY-MM-DD
- **Context:** <Problem and constraints>
- **Decision:** <Chosen approach>
- **Consequences:** <Tradeoffs and follow-up implications>
```

---

### ADR-000: Greenfield Monorepo in `d:\Projects\daak-app`
- **Status:** Accepted (Phase 0)
- **Date:** 2026-11-23
- **Context:** The legacy prototype at `D:\Projects\Daak\daak_final\Daak-main` is a JavaScript-only Next.js application with direct inline `firebase/firestore` calls embedded in UI components, mixed citizen/admin/police routes, and legacy global CSS constraints.
- **Decision:** Start a clean greenfield monorepo in `d:\Projects\daak-app` targeting separate surfaces (Citizen Mobile, Admin & Police Desktop Web, Python FastAPI API, and Supabase/PostGIS). Keep `Daak-main` untouched as a read-only reference for domain formulas, Bangladesh datasets, and assets.
- **Consequences:** Clean TypeScript/Python architecture, zero Firebase migration baggage, and a single repository deployable via subfolder root directories on free-tier hosting providers.

---

### ADR-001: Installed Universal Core Skills (`obra/superpowers`)
- **Status:** Accepted (Phase 0)
- **Date:** 2026-11-23
- **Context:** S.C.O.P.E. Phase 3 and Phase 5 require `test-driven-development` (red → green → refactor) and `requesting-code-review` (fresh-context slice and Gate 2 review) as Universal Core Skills.
- **Decision:** Installed `test-driven-development` and `requesting-code-review` globally via `npx skills add obra/superpowers --skill test-driven-development requesting-code-review -g -y` (source: `https://github.com/obra/superpowers`, selective `--skill` install rather than mega-bundle).
- **Consequences:** All 5 Universal Core Skills are now available for Phases 3 and 5 under the S.C.O.P.E. skill-count limit.

---

### ADR-002: Tier T1-Lite & Multi-Surface Free-Tier Hosting
- **Status:** Accepted (Phase 1)
- **Date:** 2026-11-23
- **Context:** Daak v2 needs real authentication, PostGIS spatial safety scoring, strict RLS, and automated tests without incurring paid monthly infrastructure bills during portfolio evaluation.
- **Decision:** Adopt `T1-Lite (Portfolio Production)` hosting `apps/web` on Vercel, `apps/api` on Render or Railway, `apps/mobile` via Expo EAS Build (`.apk`) + Expo Web Preview, and DB/Auth/Storage/Realtime on Supabase Cloud free tier, with 1-click Demo Role Accounts (`citizen`, `police`, `admin`) and simulated 999 dispatch.
- **Consequences:** Evaluators can test Citizen SOS and Police Dispatch live in browsers or on Android at \$0/month; free-tier cold starts require `/healthz/ready` and explicit loading states, and heavy ops (multi-region HA, real telco SMS) remain deferred with explicit triggers.

---

### ADR-003: FastAPI vs. Direct Supabase Operation Boundary
- **Status:** Accepted (Phase 1)
- **Date:** 2026-11-23
- **Context:** Legacy Daak mixed Firebase reads/writes and business formulas inside frontend React components.
- **Decision:** Route Auth, Realtime subscriptions, direct Storage binary uploads, and simple RLS-scoped reads directly to Supabase; route all deterministic scoring, spatial corroboration (`<= 1 km`), SOS/Safe Walk state transitions, Bangla/Banglish DaakAI, and privileged Police/Admin mutations through Python FastAPI (`/api/v1/*`).
- **Consequences:** Frontend stays thin and type-safe; business logic is centrally testable with `pytest` and guarded from client tampering.

---

### ADR-004: Pseudonymous Reporting via `security_invoker` Public Views
- **Status:** Accepted (Phase 1)
- **Date:** 2026-11-23
- **Context:** Citizens in Bangladesh often fear retaliation if their name appears on public crime feeds, yet completely anonymous unauthenticated submissions enable spam and block Police follow-up.
- **Decision:** Require authenticated reporting (`reporter_id` stored internally on `reports` and `author_id` on `report_tips`), allow an `is_anonymous_public` toggle, and serve public feeds exclusively through `public_reports_view` and `public_tips_view` declared `WITH (security_invoker = true)` to mask identities for non-staff viewers.
- **Consequences:** Preserves false-report credibility scoring and Police accountability while protecting citizen privacy on public feeds.

---

### ADR-005: Operate Visual Direction ("Dhaka Civic Dispatch & Municipal Enamel")
- **Status:** Accepted (Phase 1)
- **Date:** 2026-11-23
- **Context:** User authorized overriding visual design after applying `frontend-design` and `impeccable` (`concept-seed --scope direction --mode operate`, `seed:4d73b1a176a6c703`).
- **Decision:** Reject generic dark-mode cyber-dashboards and template AI fonts; adopt "Dhaka Civic Dispatch & Municipal Enamel" (`Civic Chalk` `#F6F7F4` / `Monsoon Slate` `#11171A`, `Dhaka Civic Teal` `#0F514A` committed rail, `Emergency Crimson` `#C81E2B` strictly for SOS/breach, `Public Sans` + `JetBrains Mono` on web, and native `Roboto`/`SF Pro` on mobile) across `DESIGN.md` and `.impeccable/surfaces/*`.
- **Consequences:** High outdoor daylight legibility on mobile, calm operational precision on desktop, and strict WCAG/native compliance.

---

### ADR-006: Supabase Cloud Project (`ap-south-1`) & Deterministic AI Fallback Handshake
- **Status:** Accepted (Phase 2)
- **Date:** 2026-11-23
- **Context:** Daak v2 targets Bangladesh users and needs low-latency South Asia PostgreSQL/PostGIS hosting plus an AI triage endpoint that continues working cleanly in free-tier demos even if no paid LLM key is configured.
- **Decision:** Provisioned Supabase Cloud project `daak-v2` (`ygdatgpfjephccykqqsc`) in `ap-south-1` (Mumbai) with `postgis` (`3.3.7`) and `pg_trgm`, and paired an OpenAI-compatible AI endpoint (`AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`) with a built-in deterministic Bangla/Banglish area & nearest-Thana safety fallback.
- **Consequences:** Sub-100ms South Asia DB/Auth proximity and guaranteed zero-cost demo uptime for DaakAI regardless of external LLM key availability.

---

### ADR-007: Hosting Selection — Vercel Hobby + Northflank Sandbox (with Render Free Fallback)
- **Status:** Accepted (Phase 5)
- **Date:** 2026-11-23
- **Context:** Evaluated free-tier hosting options from `0003-firecrawl-hosting-docs` (Vercel Hobby, Cloudflare Pages/Workers, Netlify, Firebase Hosting, Spacefast, Northflank Sandbox, Render Free, and Railway Free) for Daak v2's `apps/web` (Next.js 16), `apps/api` (Python FastAPI), `apps/mobile` (Expo Android `.apk` + Web Preview), and Supabase Cloud (`ygdatgpfjephccykqqsc`, `ap-south-1`).
- **Decision:**
  - **`apps/web` → Vercel Hobby (`$0/mo`, no card):** 100 GB Fast Data Transfer, 1M invocations, 100 deploys/day, native Next.js 16 support, and security headers via `next.config.mjs` + `apps/web/vercel.json`.
  - **`apps/api` → Northflank Sandbox (`$0/mo`, primary):** Up to `$20/mo` compute allowance (2 services, 2 jobs, 1 addon), **always-on / no sleeping** for zero cold-start SOS/Safe Walk demos, and Asia region support (`asia-southeast`) near Supabase `ap-south-1`, built via `apps/api/Dockerfile` and `apps/api/.dockerignore`. Retained **Render Free (`render.yaml`, 750 hrs/mo, no card, 15m idle sleep)** as the zero-card fallback in case Northflank requests a payment card for identity verification.
  - **`apps/mobile` → Embedded Citizen Web Preview + Expo EAS `.apk`:** Configured via `apps/mobile/eas.json` (`preview` profile).
  - **Database / Auth / Storage → Supabase Cloud:** Already provisioned and active in `ap-south-1`.
- **Consequences:** Portfolio live demos avoid 60s backend cold-start stalls while preserving an immediate zero-card Render fallback without code changes.
