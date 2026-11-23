# Daak v2 — Task Plan (S.C.O.P.E.)

## Phase 0: Initialization (Mandatory Setup)
- [x] Initialize project memory (`task_plan.md`, `findings.md`, `progress.md`)
- [x] Initialize law documents (`architecture/schemas.md`, `architecture/decisions.md`, `architecture/maintenance.md`)
- [x] Create project constitution (`AGENTS.md`, no YAML frontmatter)
- [x] Initialize git repository (`git init -b main`), `.gitignore`, and `.env.example` (variable names only)
- [x] Verify installed skills & MCPs and flag missing Universal Core Skills (`test-driven-development`, `requesting-code-review`) for user approval
- [x] Hard Halt respected: zero application source code in `src/`, `apps/`, or `tools/` until Gate 1 passes

---

## Phase 1: S — Specification (Vision & Logic) — Gate 1 *(Placeholder)*
- **Candidate Skills / Commands:** `/grill-me` (optional), `/plan`, `frontend-design` / `design-taste-frontend`, `impeccable`
- **High-Level Goal:** Define creative Daak v2 product scope, select Tier & complete 12-Layer Decision Table in `findings.md`, model schemas/PostGIS/RLS/API contracts in `architecture/schemas.md`, read UI skill `SKILL.md` files before authoring `PRODUCT.md` & `DESIGN.md`, draft threat sketch, and obtain Gate 1 user approval.

## Phase 2: C — Connections (Connectivity & Credentials) *(Placeholder)*
- **Candidate Skills / MCPs:** `references/config-templates.md`, `supabase`, `context7`, `supabase_mcp`
- **High-Level Goal:** Expand connectivity plan, verify secret hygiene, and execute minimal handshake checks for Supabase/PostGIS, Auth, FastAPI, and remote Git/CI before stopping at Phase 2 checkpoint.

## Phase 3: O — Organization (The 3-Layer Build) *(Placeholder)*
- **Candidate Skills / MCPs:** `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `context7` (and conditional `subagent-driven-development`)
- **High-Level Goal:** Build vertical feature slices (`<= 5` code files per slice) across Expo mobile, Next.js desktop web, FastAPI backend, and Supabase migrations/RLS with TDD and verification proof.

## Phase 4: P — Polish (Refinement, UI & Quality) *(Placeholder)*
- **Candidate Skills / Commands:** `impeccable`, `design-taste-frontend`, `web-design-guidelines`, `vercel-react-best-practices`, `/browser`
- **High-Level Goal:** Conduct UI/UX, accessibility, 5-state completeness, and performance audits across mobile and desktop surfaces before Phase 4 user sign-off.

## Phase 5: E — Execution (Deployment, CI/CD & Production Gate) — Gate 2 *(Placeholder)*
- **Candidate Skills / Commands:** `references/caching-and-scaling.md`, `references/skills-and-safety.md` (Deploy Rule), `requesting-code-review`, chosen hosting platform pack, `/browser`, `/learn`
- **High-Level Goal:** Satisfy every Gate 2 Production Readiness item, deploy committed code via Git/approved CLI (staging/preview first), finalize `architecture/maintenance.md`, and complete handoff.
