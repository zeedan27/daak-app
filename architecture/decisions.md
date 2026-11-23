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
