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
