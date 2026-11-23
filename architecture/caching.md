# SOP: Caching & Cache-Control Headers

## 1. Goal & Scope
Reduce repeated PostGIS aggregation overhead for map panning while guaranteeing zero stale state on live SOS alerts or private sessions.

## 2. Header & TTL Rules
- **Authenticated / User-Specific / Mutating Routes** (`/api/v1/sos*`, `/api/v1/safe-walks*`, `/api/v1/admin/*`, `/api/v1/ai/chat`): emit `Cache-Control: private, no-store`.
- **Aggregated Safety Score & Heatmap Reads** (`/api/v1/safety-score`, `/api/v1/heatmap`):
  - Backed by a `30s` deterministic `TTLCache` in FastAPI (`apps/api/app/core.py`) invalidated immediately on any report submission, corroboration, moderation, or SOS mutation.
  - Emit `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60` and `Vary: Accept-Encoding` when serving public spatial aggregates.
- **Static Web Assets:** Immutable content-hashed caching handled by Next.js / Vercel CDN (`max-age=31536000, immutable`).
