# SOP: Caching & Cache-Control Headers

## 1. Goal & Scope
Reduce repeated PostGIS aggregation overhead for map panning while guaranteeing zero stale state on live SOS alerts or private sessions.

## 2. Header & TTL Rules
- **Core Security Invariant:** Never emit `public` or `s-maxage` on any endpoint that inspects `Authorization` headers, session tokens, or private cookies.
- **Authenticated / User-Specific / Mutating Routes** (`/api/v1/sos*`, `/api/v1/safe-walks*`, `/api/v1/admin/*`, `/api/v1/ai/chat`, and staff `/api/v1/heatmap` reads): emit `Cache-Control: private, no-store`.
- **Authenticated Spatial Aggregate Reads** (`/api/v1/safety-score`, and citizen-only `/api/v1/heatmap`):
  - Backed by a `30s` deterministic `TTLCache` in FastAPI (`apps/api/app/core.py`) keyed by role/query and invalidated immediately on any report submission, corroboration, moderation, or SOS mutation.
  - Emit `Cache-Control: private, max-age=30` and `Vary: Accept-Encoding` (per-client browser cache without shared CDN caching across authenticated tokens).
- **Static Web Assets:** Immutable content-hashed caching handled by Next.js / Vercel CDN (`public, max-age=31536000, immutable`).
