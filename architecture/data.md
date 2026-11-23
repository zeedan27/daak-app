# SOP: Data Layer & PostGIS Geospatial Operations

## 1. Goal & Scope
Ensure deterministic geospatial queries, ordered database migrations, and zero-leakage public views across Supabase PostgreSQL + PostGIS (`daak-v2`, `ap-south-1`).

## 2. Spatial & Indexing Rules
- Store all spatial coordinates as `geography(Point, 4326)` using `ST_GeogFromText('SRID=4326;POINT(lng lat)')` (longitude first, latitude second).
- Every `geography` column MUST have a `GIST` spatial index; every Bangla/Banglish searchable text column (`police_stations.name_en`, `name_bn`, `reports.area_name`) MUST have a `GIN (... gin_trgm_ops)` index.
- All foreign keys and high-selectivity RLS filter columns (`reporter_id`, `user_id`, `status`, `triggered_at DESC`, `flag_status`) MUST be indexed.

## 3. Privacy-Preserving Public Views
- `public.public_reports_view` and `public.public_tips_view` MUST be created `WITH (security_invoker = true)` so underlying table RLS executes under the querying user's session.
- When `is_anonymous_public = true` and the caller is a `citizen` who is not the record owner, mask `reporter_id` / `author_id` to `NULL` and display name to `'Anonymous Citizen'`.

## 4. Migration Discipline
- Schema changes occur exclusively through numbered SQL migrations under `supabase/migrations/` and are verified via `tools/verify_schema_rls.py` and `supabase_mcp` advisors.
