# Daak v2 — Task Plan (S.C.O.P.E.)

## Phase 0: Initialization (Mandatory Setup) — Complete
- [x] Initialize project memory (`task_plan.md`, `findings.md`, `progress.md`)
- [x] Initialize law documents (`architecture/schemas.md`, `architecture/decisions.md`, `architecture/maintenance.md`)
- [x] Create project constitution (`AGENTS.md`, no YAML frontmatter)
- [x] Initialize git repository (`git init -b main`), `.gitignore`, and `.env.example`
- [x] Install missing Universal Core Skills (`test-driven-development`, `requesting-code-review`) with user approval
- [x] Hard Halt respected: zero application source code in `src/`, `apps/`, or `tools/`

---

## Phase 1: S — Specification (Vision & Logic) — Complete (Gate 1 Approved)
- [x] Conduct structured discovery (`/grill-me`) and lock Tier (`T1-Lite`), 4 creative features, Bangla/Banglish AI/search scope, pseudonymous reporting, and Demo Preview hosting
- [x] Read UI design skills (`frontend-design`, `impeccable` + `init.md`, `new-work.md`, `new-work-world.md`, `operate.md`, `mode-operate.md`, `android.md`, `ios.md`)
- [x] Author `PRODUCT.md` (`impeccable:product-schema 1`, platform `adaptive`)
- [x] Run `impeccable concept-seed --scope direction --mode operate` (`seed:4d73b1a176a6c703`), weigh challengers, and save surface briefs under `.impeccable/surfaces/`
- [x] Author `DESIGN.md` ("Dhaka Civic Dispatch & Municipal Enamel", two-pass self-critique, light/dark tokens, typography, ASCII wireframes, 5-state contract)
- [x] Define PostGIS data schemas (10 tables, `security_invoker` views, RLS matrix, storage buckets, FastAPI vs. Supabase split, `/api/v1` contracts) in `architecture/schemas.md`
- [x] Complete 12-Layer Decision Table, Phase 2–5 planned skills/MCPs, and T1-Lite Threat Model Sketch in `findings.md`
- [x] Record architectural decisions (`ADR-002` through `ADR-005`) in `architecture/decisions.md`

### Gate 1 Approval Checklist (Approved 2026-11-23)
- [x] Discovery, Tier (`T1-Lite`), 12-Layer Decision Table, Threat Sketch, and planned skills/packs recorded in `findings.md`
- [x] Data schemas, permissions matrix, and API contracts defined in `architecture/schemas.md`
- [x] `frontend-design` and `impeccable` `SKILL.md` files read via `read_file` and used to plan `PRODUCT.md`, `DESIGN.md`, and `.impeccable/surfaces/*`
- [x] **User explicitly approves Gate 1 Macro Blueprint to advance to Phase 2 (Connections)**

---

## Phase 2: C — Connections (Connectivity & Credentials) — In Progress
- [x] Read `scope/references/config-templates.md` and `supabase/SKILL.md` before planning Phase 2
- [x] Verify `supabase_mcp` and `context7` MCP connectivity (`resolve-library-id` for `@supabase/supabase-js`)
- [x] Create `.agents/rules/ui-components.md` (with `trigger: glob` frontmatter), `.agents/mcp_config.json` (zero secrets), and `.agents/hooks.json` (Windows-safe)
- [x] Create `.github/workflows/ci.yml` (`gitleaks` secret scan + connection hygiene check) and finalize `.env.example` (variable names only)
- [x] Provision Supabase Cloud project `daak-v2` in `ap-south-1` (`ACTIVE_HEALTHY`) and verify `postgis` + `pg_trgm` spatial handshake
- [x] Create and execute `tools/verify_connections.py` (hygiene/frontmatter, JSON log redaction, Supabase Auth & REST health handshake, Bangla/Banglish DaakAI deterministic fallback handshake, Git/CI check)
- [x] Record Phase 2 handshake results in `findings.md`, `architecture/decisions.md` (`ADR-006`), and `progress.md`
- [ ] **Phase 2 Checkpoint — Stop and obtain user confirmation before Phase 3**

## Phase 3: O — Organization (The 3-Layer Build) *(Placeholder)*
- **Candidate Skills / MCPs:** `scope/references/stack-matrix.md`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `context7` MCP
- **High-Level Goal:** Build vertical feature slices (`<= 5` code files per slice) across Supabase migrations/RLS/seed, Python FastAPI domain services, Next.js Police & Admin Desktop Web, and Expo Citizen Mobile (+ Web Preview) with TDD, review gates, and `progress.md` proof.

## Phase 4: P — Polish (Refinement, UI & Quality) *(Placeholder)*
- **Candidate Skills / Commands:** `impeccable`, `web-design-guidelines`, `vercel-react-best-practices`, `/browser`
- **High-Level Goal:** Run `impeccable` (`detect`, `audit`, `polish`, `document`), WCAG 2.1 AA accessibility checks, 5-state completeness checks, and responsive viewport verification across mobile and desktop before Phase 4 user sign-off.

## Phase 5: E — Execution (Deployment, CI/CD & Production Gate) — Gate 2 *(Placeholder)*
- **Candidate Skills / Commands:** `scope/references/caching-and-scaling.md`, `scope/references/skills-and-safety.md` (Deploy Rule), `requesting-code-review`, Vercel/Render/Expo EAS Git deploys, `/browser`, `/learn`
- **High-Level Goal:** Satisfy every Gate 2 Production Readiness item (builds, secret scan, negative RLS/auth tests, rate limiting, health probes, staging smoke tests), deploy committed code via Git/approved CLIs, finalize `architecture/maintenance.md`, and complete handoff.
