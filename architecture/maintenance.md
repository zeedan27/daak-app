# Daak v2 — Maintenance, Operations & Runbooks

> **Status:** Phase 5 Production Runbook (`T1-Lite`, Gate 2 Ready).
> **Deploy Rule:** Deploy only committed code on `main` through Git integration (Vercel / Northflank / Render / GitHub Actions) or approved platform CLIs after verifying clean `git status`, secret exclusion, and staging/preview first. Never upload raw local folders as tool arguments.

---

## 1. Deployment Runbooks (Git-Integrated)

### A. Supabase Cloud (`ygdatgpfjephccykqqsc`, `ap-south-1`)
1. Database schema and RLS migrations live in `supabase/migrations/`:
   - `20261123000100_init_daak_schema_and_rls.sql`
   - `20261123000200_seed_bangladesh_demo_data.sql`
   - `20261123000300_security_hardening_and_indexes.sql`
2. Apply any new migration via Supabase CLI (`supabase db push`) or reviewed SQL migration, then run `python tools/verify_schema_rls.py` and `python tools/verify_connections.py`.

### B.1 FastAPI Domain API (`apps/api` → Northflank Sandbox, Primary Always-On)
1. Create a Northflank **Developer Sandbox** project in `asia-southeast` (nearest Asia region to Supabase `ap-south-1`).
2. Create a Git-integrated **Combined Service** connected to the GitHub repository `zeedan27/daak-app` (`https://github.com/zeedan27/daak-app`, branch `main`):
   - **Build Type:** `Dockerfile`
   - **Dockerfile Path:** `/apps/api/Dockerfile` (paired with `apps/api/.dockerignore`)
   - **Build Context:** `/apps/api`
   - **Port:** `8000` (HTTP, public ingress)
   - **Compute Plan:** `nf-compute-20` (`0.2 vCPU` / `512 MiB` RAM) or `nf-compute-50` (`0.5 vCPU` / `1 GiB` RAM) within the Sandbox `\$20/mo` free allowance (always on, no sleep).
3. Configure Health Checks in Northflank:
   - **Liveness Probe:** HTTP `GET /healthz/live` on port `8000` (expects HTTP `200`, `status: "alive"`).
   - **Readiness Probe:** HTTP `GET /healthz/ready` on port `8000` (expects HTTP `200`, `status: "ready"`, `Cache-Control: private, no-store`; transitions to HTTP `503` `status: "draining"` on `SIGTERM`).
4. Configure environment variables / secrets in Northflank Service settings:
   - `API_ENV=production`, `DEMO_MODE=true`, `AI_MODEL=gpt-4.1-mini`, `AI_FALLBACK_ENABLED=true`
   - Secret vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `API_CORS_ORIGINS` (comma-separated deployed Vercel URL + Expo web preview origin)
   - `AI_BASE_URL` / `AI_API_KEY` (optional; deterministic Bangla/Banglish fallback remains active when unset because `AI_FALLBACK_ENABLED=true`)
   - Set `DEMO_MODE=false` when transitioning from portfolio demo to public production.

### B.2 FastAPI Domain API (`apps/api` → Render Free Blueprint `render.yaml`, Zero-Card Fallback)
1. If Northflank requires card verification for your account, connect `zeedan27/daak-app` (`https://github.com/zeedan27/daak-app`) in Render and select **Blueprint** (`render.yaml` at repo root).
2. Configure the same secret environment variables in Render Dashboard (`sync: false` in `render.yaml`), noting Render Free spins down after 15 minutes idle.
3. Verify `/healthz/live` and `/healthz/ready` probes (`uvicorn` runs with `--timeout-keep-alive 65` in both Dockerfile and `render.yaml`).

### C. Police & Admin Desktop Web + Citizen Web Preview (`apps/web` → Vercel Hobby)
1. Import `zeedan27/daak-app` (`https://github.com/zeedan27/daak-app`) in Vercel with **Root Directory** set to `apps/web` (`apps/web/vercel.json` + `apps/web/.vercelignore`).
2. Configure public environment variables in Vercel (strictly public allowlist — never put `SUPABASE_SERVICE_ROLE_KEY` or `AI_API_KEY` in `NEXT_PUBLIC_*`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_BASE_URL` (deployed Northflank API URL, or Render fallback URL)
3. Deploy to **Preview** branch/PR first, run smoke checks on the preview URL, then promote/merge to `main` for Production.

### D. Citizen Mobile App (`apps/mobile` → Expo EAS Build)
1. Configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_BASE_URL` in EAS environment secrets (`eas.json` `preview` profile targets installable Android `.apk`; `production` targets `.aab`).
2. Build preview APK from committed code:
   ```bash
   cd apps/mobile
   npx eas build -p android --profile preview
   ```

---

## 2. Rollback Procedures

1. **Web (`apps/web` on Vercel):**
   - Instant rollback via Vercel Dashboard → **Deployments** → select previous verified Production deployment → **Promote to Production** (zero rebuild latency).
2. **API (`apps/api` on Northflank / Render):**
   - Trigger **Roll back to previous deployment** in Northflank (or **Rollback to Previous Deploy** in Render), or revert the offending commit in Git (`git revert <sha> --no-edit && git push origin main`) so CI re-runs before auto-deploy.
3. **Database (`supabase/migrations/`):**
   - **Never** run destructive `DROP` or history-rewriting edits against live production data. Write an additive forward-fix SQL migration reverting the faulty column/policy, or restore from Supabase daily snapshot (`Dashboard -> Database -> Backups`).
4. **Mobile (`apps/mobile`):**
   - Re-distribute the previous verified `preview` `.apk` artifact or publish a rollback OTA bundle via EAS Update on the `preview` channel.

---

## 3. Secret Rotation Guide

Rotate keys immediately if a secret leak is suspected or on a 90-day schedule:
1. **Supabase `service_role` / `anon` / JWT keys:**
   - Regenerate in Supabase Dashboard (`Project Settings -> API`).
   - Update `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_JWT_SECRET` if used) in Northflank (or Render fallback) first, then `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS.
   - Trigger rolling redeploy on Northflank/Render and Vercel; confirm `/healthz/ready` returns `200` and `python tools/verify_connections.py` exits `0`.
2. **`AI_API_KEY`:**
   - Issue new key at provider, update Northflank/Render env var, redeploy `daak-v2-api`, then revoke old key. Deterministic fallback (`AI_FALLBACK_ENABLED=true`) prevents downtime during rotation.
3. **Local `.env` files:**
   - Never committed (`.gitignore` excludes `.env` and `.env.*`, except `.env.example`). Verify after any edit with `gitleaks git --no-banner --redact`.

---

## 4. Backup & Restore Verification

- **Supabase Free Tier (`T1-Lite`):** Automated daily backups managed by Supabase; verify backup status in Supabase Dashboard before destructive migrations.
- **Logical Export Snapshot (Pre-Migration Check):**
  ```bash
  supabase db dump --linked -f .tmp/daak_pre_migration_$(date +%Y%m%d).sql
  ```
  *(Store exports strictly in `.tmp/`, which is gitignored; never commit database dumps.)*
- **Restore Verification:** Test logical restore against a disposable local/staging branch before running schema upgrades on production.

---

## 5. Cost Caps & Budget Alerts (`T1-Lite` \$0 Guardrails)

| Service | Tier | Hard Limit / Protection | Alert / Action |
|---|---|---|---|
| **Vercel** | Hobby (`$0`) | 100 GB Fast Data Transfer + `vercel.json` immutable static caching (`max-age=31536000`) | Enable Vercel Usage alerts at 75% quota |
| **Northflank (Primary)** | Sandbox (`$0`) | Up to `$20/mo` compute allowance (`nf-compute-20` / `nf-compute-50`, always-on) | Configure Northflank spending & quota alerts well below `$20/mo` |
| **Render (Fallback)** | Free Web (`$0`) | 750 free instance hours/month; `/healthz/live` & `/healthz/ready` cold-start tolerant | Configure external uptime monitor (5m interval) + Render billing email cap |
| **Supabase** | Free (`$0`) | 500 MB DB, 1 GB private Storage, 50k MAU | Monitor DB/Storage usage in Supabase Usage panel; enforce file-size limits |
| **AI Provider** | Optional / Cap | FastAPI `SlidingWindowRateLimiter` (`20 req/min/user` on `/api/v1/ai/chat`) + `500` char input cap + `AI_FALLBACK_ENABLED=true` | Set hard monthly spend cap (`$5`) at LLM provider; service degrades gracefully to deterministic Bangla/Banglish engine |

---

## 6. Deferred Layer Revisit Triggers (Aligned with `findings.md`)

| Layer | Current (`T1-Lite`) | Revisit Trigger | Upgrade Path |
|---|---|---|---|
| **1. Mobile iOS Release** | Android `.apk` + Expo Web Preview | Public iOS App Store distribution required | Add Apple Developer signing + background location task (`eas.json` iOS profile) |
| **2. Background Jobs** | Synchronous FastAPI + PostGIS | `> 200 req/s` or heavy async media/EXIF processing | Split background workers (ARQ / Celery + Redis) |
| **3. Database Tier** | Supabase Free (500 MB / 1 GB) | `> 400 MB` DB or PITR compliance required | Upgrade to Supabase Pro with daily PITR |
| **4. Auth & Demo Mode** | Email/JWT + `DEMO_MODE=true` 1-click switch | Public civic pilot launch | Set `DEMO_MODE=false` + enforce NID/phone OTP verification |
| **5. Always-On Compute** | Northflank Sandbox (`$20/mo` always-on) + Render Free fallback | Sandbox compute allowance exceeded or Render cold starts hit | Scale Northflank Pay-as-you-go (`nf-compute-50+`) or Render `plan: starter` |
| **9. Distributed Rate Limit** | In-memory `SlidingWindowRateLimiter` | Multi-instance scaling or `> 300 req/min` | Plug Upstash Redis (`upstash-ratelimit`) behind existing limiter interface |
| **10. Distributed Cache** | In-memory 30s `TTLCache` | High concurrent map panning across replicas | Plug Redis (`redis-best-practices`) for spatial query cache |
| **11. Load Balancing & Pooling** | Single-instance Northflank/Render + direct REST | `> 500` concurrent dispatch rooms | Enable horizontal FastAPI replicas + Supavisor/PgBouncer transaction pooler |
| **12. External APM** | Structured JSON logs + `activity_logs` | Live public citizen pilot | Connect Sentry DSN (read-only MCP / alert webhook) |
