# Daak v2 — Data Schemas, Permissions & API Contracts

> **Status:** Phase 1 Specification (Authoritative Contract — Gate 1).
> **Database Engine:** PostgreSQL 15+ on Supabase Cloud with `postgis` and `pg_trgm` extensions.

---

## 1. PostgreSQL Extensions & Spatial Conventions
- **Extensions:** `postgis` (spatial geography & radius checks), `pg_trgm` (fuzzy Bangla/Banglish area & Thana name matching), `pgcrypto` (`gen_random_uuid()`).
- **Coordinate System:** WGS84 (`SRID 4326`) stored as `geography(Point, 4326)` for accurate meter-level distance (`ST_DWithin`) across Bangladesh (`lat ~ 20.5–26.7`, `lng ~ 88.0–92.7`).
- **Mandatory Indexing:**
  - `GIST` index on every `geography(Point, 4326)` column.
  - `GIN (... gin_trgm_ops)` on `area_name` and Thana names for rapid Bangla/Banglish search.
  - `B-tree` indexes on all foreign keys, `status`, `created_at DESC`, and composite `(flag_status, suspicion_score DESC)` / `(status, triggered_at DESC)`.

---

## 2. Core Tables (10 Tables)

### 2.1 `profiles`
Extends `auth.users` 1:1. Created automatically via `AFTER INSERT ON auth.users` trigger (always defaults `role = 'citizen'`).
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK, FK -> auth.users(id) ON DELETE CASCADE` | Matches Supabase Auth UID |
| `full_name` | `text` | `NOT NULL DEFAULT 'Daak User'` | Display name when not anonymous |
| `phone` | `text` | `NULL` | Bangladesh format `+8801...` |
| `role` | `text` | `NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','police','admin'))` | Protected against client self-escalation |
| `station_id` | `uuid` | `NULL, FK -> police_stations(id) ON DELETE SET NULL` | Assigned Thana for `police` role |
| `credibility_score` | `integer` | `NOT NULL DEFAULT 75 CHECK (credibility_score BETWEEN 0 AND 100)` | Used in false-report heuristics |
| `is_verified` | `boolean` | `NOT NULL DEFAULT false` | Verified citizen / badge status |
| `is_demo_account` | `boolean` | `NOT NULL DEFAULT false` | Marks seeded 1-click demo accounts |
| `emergency_contacts` | `jsonb` | `NOT NULL DEFAULT '[]'::jsonb` | `[{name, phone, relation}]` |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.2 `police_stations`
Bangladesh Thanas / Police Stations for nearest-station lookup and dispatch routing.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `name_en` | `text` | `NOT NULL` | e.g., `Dhanmondi Model Police Station` |
| `name_bn` | `text` | `NOT NULL` | e.g., `ধানমন্ডি মডেল থানা` |
| `aliases` | `text[]` | `NOT NULL DEFAULT '{}'` | Banglish/local spelling variants |
| `district` | `text` | `NOT NULL` | e.g., `Dhaka` |
| `division` | `text` | `NOT NULL` | e.g., `Dhaka` |
| `phone` | `text` | `NOT NULL` | Duty officer contact |
| `location` | `geography(Point, 4326)` | `NOT NULL` | `GIST` indexed |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.3 `reports`
Citizen-submitted crime and safety incident reports.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `reporter_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE RESTRICT` | Always stored internally for accountability |
| `is_anonymous_public` | `boolean` | `NOT NULL DEFAULT false` | Hides reporter identity in public views |
| `category` | `text` | `NOT NULL CHECK (category IN ('snatching','theft','assault','harassment','fraud','vandalism','suspicious_activity','traffic_hazard','other'))` | |
| `severity` | `text` | `NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical'))` | |
| `title` | `text` | `NOT NULL` | Short incident headline (`<= 140` chars) |
| `description` | `text` | `NOT NULL` | Detailed account |
| `area_name` | `text` | `NOT NULL` | e.g., `Dhanmondi`, `Mirpur-10` |
| `address_text` | `text` | `NULL` | Landmark / street description |
| `location` | `geography(Point, 4326)` | `NOT NULL` | `GIST` indexed |
| `occurred_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Used for night/day safety weighting |
| `media_urls` | `text[]` | `NOT NULL DEFAULT '{}'` | Storage object paths in `evidence-media` |
| `status` | `text` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','investigating','resolved','rejected'))` | |
| `assigned_officer_id` | `uuid` | `NULL, FK -> profiles(id) ON DELETE SET NULL` | Police officer handling case |
| `corroboration_count` | `integer` | `NOT NULL DEFAULT 0` | Maintained atomically by FastAPI/trigger |
| `suspicion_score` | `integer` | `NOT NULL DEFAULT 0 CHECK (suspicion_score BETWEEN 0 AND 100)` | Computed by FastAPI 5-factor detector |
| `flag_status` | `text` | `NOT NULL DEFAULT 'none' CHECK (flag_status IN ('none','flagged','cleared','confirmed_false'))` | |
| `suspicion_reasons` | `jsonb` | `NOT NULL DEFAULT '[]'::jsonb` | Structured breakdown of heuristic hits |
| `moderation_note` | `text` | `NULL` | Admin/Police review note |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.4 `report_corroborations`
Distance-verified community corroborations ("I Saw This Too").
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `report_id` | `uuid` | `NOT NULL, FK -> reports(id) ON DELETE CASCADE` | |
| `user_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE CASCADE` | `UNIQUE(report_id, user_id)` |
| `user_location` | `geography(Point, 4326)` | `NOT NULL` | Captured at corroboration time |
| `distance_meters` | `double precision` | `NOT NULL CHECK (distance_meters >= 0 AND distance_meters <= 1000)` | Server-enforced `<= 1000 m` via PostGIS |
| `note` | `text` | `NULL` | Optional brief witness context |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.5 `report_tips`
Community tips/comments attached to verified/public reports.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `report_id` | `uuid` | `NOT NULL, FK -> reports(id) ON DELETE CASCADE` | |
| `author_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE CASCADE` | |
| `is_anonymous_public` | `boolean` | `NOT NULL DEFAULT false` | Masks author in `public_tips_view` |
| `body` | `text` | `NOT NULL` | |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.6 `distress_signals`
Real-time SOS panic alerts and Safe Walk timeout escalations.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `user_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE RESTRICT` | |
| `trigger_source` | `text` | `NOT NULL DEFAULT 'panic_button' CHECK (trigger_source IN ('panic_button','safe_walk_timeout'))` | |
| `location` | `geography(Point, 4326)` | `NOT NULL` | `GIST` indexed |
| `area_name` | `text` | `NULL` | Resolved neighborhood/Thana label |
| `battery_level` | `integer` | `NULL CHECK (battery_level BETWEEN 0 AND 100)` | Device diagnostic context |
| `note` | `text` | `NULL` | Optional citizen voice/text note |
| `status` | `text` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active','claimed','responding','resolved','cancelled','false_alarm'))` | |
| `claimed_by` | `uuid` | `NULL, FK -> profiles(id) ON DELETE SET NULL` | Dispatching police officer |
| `assigned_unit` | `text` | `NULL` | e.g., `Dhanmondi Patrol-04` |
| `triggered_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Anchor for live `MM:SS` SLA timer |
| `claimed_at` | `timestamptz` | `NULL` | |
| `resolved_at` | `timestamptz` | `NULL` | |
| `sla_target_seconds` | `integer` | `NOT NULL DEFAULT 300` | Default 5 min target SLA |
| `dispatch_timeline` | `jsonb` | `NOT NULL DEFAULT '[]'::jsonb` | `[{at, actor_id, status, note}]` |

### 2.7 `safe_walks`
Escort trip timers that auto-escalate to `distress_signals` if missed.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `user_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE CASCADE` | |
| `destination_name` | `text` | `NOT NULL` | e.g., `TSC, Dhaka University` |
| `destination_location` | `geography(Point, 4326)` | `NULL` | Optional map pin |
| `last_known_location` | `geography(Point, 4326)` | `NOT NULL` | Updated on check-in / trigger |
| `expected_arrival_at` | `timestamptz` | `NOT NULL` | Timer deadline |
| `status` | `text` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','escalated','cancelled'))` | |
| `escalated_sos_id` | `uuid` | `NULL, FK -> distress_signals(id) ON DELETE SET NULL` | Linked SOS if missed |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.8 `shift_handovers`
Police shift briefing notes for dispatch continuity.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `outgoing_officer_id` | `uuid` | `NOT NULL, FK -> profiles(id) ON DELETE RESTRICT` | |
| `station_id` | `uuid` | `NULL, FK -> police_stations(id) ON DELETE SET NULL` | |
| `shift_label` | `text` | `NOT NULL` | e.g., `Night Shift (22:00–06:00)` |
| `summary` | `text` | `NOT NULL` | Operational handover brief |
| `open_sos_ids` | `uuid[]` | `NOT NULL DEFAULT '{}'` | Active SOS references carried over |
| `priority_areas` | `text[]` | `NOT NULL DEFAULT '{}'` | High-alert neighborhoods |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.9 `criminals`
Wanted / Criminal Watchlist managed by Admins and searchable by Citizens & Police.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `full_name` | `text` | `NOT NULL` | |
| `aliases` | `text[]` | `NOT NULL DEFAULT '{}'` | |
| `crime_categories` | `text[]` | `NOT NULL DEFAULT '{}'` | |
| `risk_level` | `text` | `NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical'))` | |
| `last_known_area` | `text` | `NOT NULL` | |
| `last_known_location` | `geography(Point, 4326)` | `NULL` | `GIST` indexed |
| `photo_url` | `text` | `NULL` | Stored in `criminal-photos` bucket |
| `status` | `text` | `NOT NULL DEFAULT 'wanted' CHECK (status IN ('wanted','in_custody','archived'))` | |
| `details` | `text` | `NOT NULL DEFAULT ''` | Physical description & case summary |
| `created_by` | `uuid` | `NULL, FK -> profiles(id) ON DELETE SET NULL` | |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

### 2.10 `activity_logs`
Append-only audit trail for Admin, Police, and automated moderation events.
| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PK DEFAULT gen_random_uuid()` | |
| `actor_id` | `uuid` | `NULL, FK -> profiles(id) ON DELETE SET NULL` | `NULL` for system/cron |
| `actor_role` | `text` | `NOT NULL` | `citizen` / `police` / `admin` / `system` |
| `action` | `text` | `NOT NULL` | e.g., `sos.claimed`, `report.moderated`, `criminal.created` |
| `target_type` | `text` | `NOT NULL` | Table/resource name |
| `target_id` | `uuid` | `NULL` | Target entity UUID |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'::jsonb` | Never store secrets/PII beyond operational IDs |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | |

---

## 3. Privacy-Preserving Public Views (`security_invoker = true`)

All PostgreSQL views MUST declare `WITH (security_invoker = true)` so underlying RLS executes under the querying user's privileges.

1. **`public_reports_view`**
   - Selects public columns from `reports` joined with `profiles` (for display name only).
   - **Identity Masking Rule:**
     - If `is_anonymous_public = true` AND viewer is NOT `police`/`admin` AND viewer is NOT `reporter_id`: returns `reporter_id = NULL`, `reporter_display_name = 'Anonymous Citizen'`.
     - Otherwise returns `reporter_display_name = profiles.full_name` (while `reporter_id` is still omitted from public feed payloads unless viewer is owner/police/admin).
   - **Visibility Rule:** Exposes `status IN ('verified','investigating','resolved')`, plus any `pending` report where `reporter_id = auth.uid()`.
2. **`public_tips_view`**
   - Selects `id, report_id, body, is_anonymous_public, created_at`, and `author_display_name` (`'Anonymous Citizen'` when `is_anonymous_public = true` for non-staff viewers).

---

## 4. Roles & Row-Level Security (RLS) Matrix

**Default Posture:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on all 10 tables. Default-deny (`anon` receives zero access to user/incident tables; evaluators use 1-click Demo Accounts).

| Table / Bucket | `citizen` (own / public) | `police` | `admin` |
|---|---|---|---|
| `profiles` | `SELECT`/`UPDATE` own row ONLY (trigger/check blocks modifying `role`, `credibility_score`, `is_verified`) | `SELECT` all profiles (operational lookup), `UPDATE` own non-role fields | `SELECT` all profiles; role elevation via `service_role` only |
| `police_stations` | `SELECT` all | `SELECT` all | `SELECT`/`INSERT`/`UPDATE`/`DELETE` |
| `reports` | `INSERT` own (`reporter_id = auth.uid()`), `SELECT` own + `verified`/`investigating`/`resolved` (via `public_reports_view` in UI); cannot edit `status`/`suspicion_score` | `SELECT` all; `UPDATE` operational status/assignment (`verified`, `investigating`, `resolved`, `rejected`) | `SELECT` all; full moderation `UPDATE` & `DELETE` |
| `report_corroborations` | `SELECT` on visible reports; `INSERT` own (via FastAPI PostGIS `<= 1000m` verification) | `SELECT` all | `SELECT`/`DELETE` |
| `report_tips` | `SELECT` on visible reports; `INSERT` own (`author_id = auth.uid()`); `DELETE` own | `SELECT` all; `INSERT` own | `SELECT`/`DELETE` all |
| `distress_signals` | `INSERT` own (`user_id = auth.uid()`); `SELECT` own; `UPDATE` own ONLY to `cancelled` while `status = 'active'` | `SELECT` all; `UPDATE` dispatch status (`claimed`, `responding`, `resolved`, `false_alarm`), `assigned_unit`, `dispatch_timeline` | `SELECT` all; `UPDATE` all |
| `safe_walks` | `SELECT`/`INSERT`/`UPDATE` own rows ONLY | `SELECT` escalated rows ONLY | `SELECT` all |
| `shift_handovers` | Deny | `SELECT`/`INSERT` (own `outgoing_officer_id`) | `SELECT`/`INSERT`/`UPDATE`/`DELETE` |
| `criminals` | `SELECT` where `status IN ('wanted','in_custody')` | `SELECT` all | `SELECT`/`INSERT`/`UPDATE`/`DELETE` |
| `activity_logs` | Deny | `SELECT` own/police operational logs | `SELECT` all (`INSERT` via `service_role` / FastAPI only; immutable — no `UPDATE`/`DELETE`) |
| Bucket `evidence-media` | Private; `INSERT` under `{uid}/*`; `SELECT` own via signed URL | `SELECT` via signed URL | `SELECT`/`DELETE` via signed URL |
| Bucket `criminal-photos` | `SELECT` (authenticated read) | `SELECT` | `SELECT`/`INSERT`/`UPDATE`/`DELETE` |

---

## 5. FastAPI vs. Direct Supabase Operation Boundary

| Operation | Path | Why |
|---|---|---|
| Sign up, login, password reset, 1-click Demo sign-in, JWT refresh | **Direct Supabase Auth** | Standard PKCE/JWT auth, zero custom password handling |
| Live SOS, Safe Walk & Verified Report stream subscriptions | **Direct Supabase Realtime** | WebSocket Postgres Changes filtered by RLS |
| Evidence photo/video upload & signed read URL | **Direct Supabase Storage** | Avoids proxying large binary media through free-tier FastAPI |
| Simple scoped reads (`public_reports_view`, `police_stations`, `criminals`, own `profiles`) | **Direct Supabase Client (RLS)** | Fast read path with Postgres RLS enforcement |
| **SOS Trigger, Dispatch State Machine & Live SLA** | **FastAPI (`/api/v1/sos/*`)** | Enforces legal status transitions, computes nearest Thana, records immutable `dispatch_timeline` + `activity_logs`, simulates 999 alert log |
| **Safe Walk Lifecycle & Auto-Escalation** | **FastAPI (`/api/v1/safe-walks/*`)** | Atomic check-in/timeout escalation creating a linked `distress_signals` row idempotently |
| **Report Submission + 5-Factor False-Report Scoring** | **FastAPI (`/api/v1/reports`)** | Runs deterministic credibility, PostGIS near-duplicate check, rapid spam, detail consistency, and suspicious content heuristics before saving |
| **1 km Community Corroboration ("I Saw This Too")** | **FastAPI (`/api/v1/reports/{id}/corroborate`)** | Verifies `ST_DWithin <= 1000m` server-side, prevents self-corroboration, updates `corroboration_count` & lowers suspicion |
| **Area Safety Score & Heatmap Aggregation** | **FastAPI (`/api/v1/analytics/*`)** | Deterministic 40% frequency / 35% resolution / 25% night-hour weighting + PostGIS clustering |
| **DaakAI Assistant + Nearest Thana Lookup** | **FastAPI (`/api/v1/ai/chat`)** | Extracts English/Bangla/Banglish area intent, queries PostGIS reports + nearest Thana, injects safe grounded prompt, enforces rate limits |
| **Admin Moderation, Criminal CRUD, Shift Handovers** | **FastAPI (`/api/v1/admin/*`, `/api/v1/police/*`)** | Enforces server role checks, writes `activity_logs` atomically |

---

## 6. FastAPI Endpoint Table & Payload Contracts (`/api/v1`)

### Standard Response Envelopes
- **Success Envelope:**
  ```json
  {
    "data": {},
    "meta": { "request_id": "req_01J...", "synthetic_demo": true }
  }
  ```
- **Error Envelope (Machine-Readable Codes):**
  ```json
  {
    "error": {
      "code": "CORROBORATION_OUT_OF_RANGE",
      "message": "You must be within 1 km of the incident to corroborate it.",
      "details": { "distance_meters": 1840, "max_meters": 1000 },
      "request_id": "req_01J..."
    }
  }
  ```
  Standard codes: `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INVALID_STATE_TRANSITION`, `CORROBORATION_OUT_OF_RANGE`, `DUPLICATE_CORROBORATION`, `SELF_CORROBORATION_FORBIDDEN`, `RESOURCE_NOT_FOUND`, `AI_PROVIDER_UNAVAILABLE`.

### Endpoint Map
| Method & Path | Auth Role | Purpose |
|---|---|---|
| `GET /healthz/live` | Public | Liveness probe (process up) |
| `GET /healthz/ready` | Public | Readiness probe (verifies Supabase DB connection) |
| `POST /api/v1/sos` | `citizen`+ | Create SOS signal (idempotency key supported) + return nearest Thana |
| `PATCH /api/v1/sos/{id}/cancel` | `citizen` (owner) | Cancel own `active` SOS |
| `PATCH /api/v1/sos/{id}/dispatch` | `police`, `admin` | Transition `active -> claimed -> responding -> resolved / false_alarm`, assign unit, append timeline |
| `POST /api/v1/safe-walks` | `citizen`+ | Start Safe Walk timer |
| `PATCH /api/v1/safe-walks/{id}/checkin` | `citizen` (owner) | Complete, extend, or cancel Safe Walk |
| `POST /api/v1/safe-walks/{id}/escalate` | `citizen` (owner) / `admin` | Escalate overdue Safe Walk into a `distress_signals` row |
| `POST /api/v1/reports` | `citizen`+ | Submit report + compute 5-factor `suspicion_score` |
| `POST /api/v1/reports/{id}/corroborate` | `citizen`+ | Verify `<= 1 km` via PostGIS & increment `corroboration_count` |
| `GET /api/v1/safety-score` | Authenticated | Compute Safety Score for area or `(lat, lng, radius_m)` |
| `GET /api/v1/heatmap` | Authenticated | Return PostGIS clustered crime/SOS points with time/category filters |
| `GET /api/v1/thanas/nearest` | Authenticated | Nearest Bangladesh police stations by `(lat, lng)` or Bangla/Banglish query |
| `POST /api/v1/ai/chat` | Authenticated | Bangla/Banglish/English DaakAI safety assistant grounded on recent PostGIS context |
| `POST /api/v1/police/handovers` | `police`, `admin` | Create shift handover log |
| `GET /api/v1/admin/false-reports` | `admin` | List flagged reports sorted by `suspicion_score DESC` |
| `PATCH /api/v1/admin/reports/{id}/moderate` | `police` (status) / `admin` (all) | Approve, reject, clear flag, or mark confirmed false + update credibility + log |
| `POST/PATCH/DELETE /api/v1/admin/criminals` | `admin` | Criminal watchlist CRUD + audit log |
| `GET /api/v1/admin/analytics` | `admin` | Summary metrics, category breakdown, SLA averages |
