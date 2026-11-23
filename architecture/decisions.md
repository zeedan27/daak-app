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
