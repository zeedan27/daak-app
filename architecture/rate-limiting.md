# SOP: Rate Limiting

## 1. Goal & Scope
Protect free-tier compute, LLM quotas, and Police SOS dispatch queues from spam or accidental demo loops.

## 2. Sliding-Window Limits
- Key counters by authenticated `user_id` (fallback to client IP on unauthenticated routes).
- Configured thresholds (configurable via env, enforced deterministically in `apps/api/app/core.py`):
  - `POST /api/v1/sos`: `10` requests / `60s`
  - `POST /api/v1/reports`: `15` requests / `60s`
  - `POST /api/v1/ai/chat`: `20` requests / `60s`
- Exceeded limits fail closed with HTTP `429`, `Retry-After` response header (integer seconds), and machine-readable error code `RATE_LIMITED`.
- Upgrade path (Layer 9 revisit trigger): swap `SlidingWindowRateLimiter` backend for Upstash Redis when running `> 1` FastAPI worker instance.
