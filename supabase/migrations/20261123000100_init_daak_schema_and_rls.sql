-- ============================================================================
-- Daak v2 — Core PostGIS Schema, Default-Deny RLS, Public Views & Storage
-- Migration: 20261123000100_init_daak_schema_and_rls
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;

-- ----------------------------------------------------------------------------
-- 1. Core Tables (10 Tables)
-- ----------------------------------------------------------------------------

CREATE TABLE public.police_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_bn text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  district text NOT NULL,
  division text NOT NULL,
  phone text NOT NULL,
  location geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Daak User',
  phone text NULL,
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'police', 'admin')),
  station_id uuid NULL REFERENCES public.police_stations(id) ON DELETE SET NULL,
  credibility_score integer NOT NULL DEFAULT 75 CHECK (credibility_score BETWEEN 0 AND 100),
  is_verified boolean NOT NULL DEFAULT false,
  is_demo_account boolean NOT NULL DEFAULT false,
  emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_anonymous_public boolean NOT NULL DEFAULT false,
  category text NOT NULL CHECK (
    category IN (
      'snatching',
      'theft',
      'assault',
      'harassment',
      'fraud',
      'vandalism',
      'suspicious_activity',
      'traffic_hazard',
      'other'
    )
  ),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL CHECK (char_length(title) <= 140),
  description text NOT NULL,
  area_name text NOT NULL,
  address_text text NULL,
  location geography(Point, 4326) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  media_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'investigating', 'resolved', 'rejected')),
  assigned_officer_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  corroboration_count integer NOT NULL DEFAULT 0 CHECK (corroboration_count >= 0),
  suspicion_score integer NOT NULL DEFAULT 0 CHECK (suspicion_score BETWEEN 0 AND 100),
  flag_status text NOT NULL DEFAULT 'none' CHECK (flag_status IN ('none', 'flagged', 'cleared', 'confirmed_false')),
  suspicion_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  moderation_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.report_corroborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_location geography(Point, 4326) NOT NULL,
  distance_meters double precision NOT NULL CHECK (distance_meters >= 0 AND distance_meters <= 1000),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

CREATE TABLE public.report_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_anonymous_public boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.distress_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  trigger_source text NOT NULL DEFAULT 'panic_button' CHECK (trigger_source IN ('panic_button', 'safe_walk_timeout')),
  location geography(Point, 4326) NOT NULL,
  area_name text NULL,
  battery_level integer NULL CHECK (battery_level BETWEEN 0 AND 100),
  note text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'responding', 'resolved', 'cancelled', 'false_alarm')),
  claimed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_unit text NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz NULL,
  resolved_at timestamptz NULL,
  sla_target_seconds integer NOT NULL DEFAULT 300 CHECK (sla_target_seconds > 0),
  dispatch_timeline jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE public.safe_walks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_name text NOT NULL,
  destination_location geography(Point, 4326) NULL,
  last_known_location geography(Point, 4326) NOT NULL,
  expected_arrival_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'escalated', 'cancelled')),
  escalated_sos_id uuid NULL REFERENCES public.distress_signals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_officer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  station_id uuid NULL REFERENCES public.police_stations(id) ON DELETE SET NULL,
  shift_label text NOT NULL,
  summary text NOT NULL,
  open_sos_ids uuid[] NOT NULL DEFAULT '{}',
  priority_areas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.criminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  crime_categories text[] NOT NULL DEFAULT '{}',
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  last_known_area text NOT NULL,
  last_known_location geography(Point, 4326) NULL,
  photo_url text NULL,
  status text NOT NULL DEFAULT 'wanted' CHECK (status IN ('wanted', 'in_custody', 'archived')),
  details text NOT NULL DEFAULT '',
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. Spatial (GIST), Trigram (GIN) & Operational Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX idx_police_stations_location_gist ON public.police_stations USING GIST (location);
CREATE INDEX idx_police_stations_name_en_trgm ON public.police_stations USING GIN (name_en gin_trgm_ops);
CREATE INDEX idx_police_stations_name_bn_trgm ON public.police_stations USING GIN (name_bn gin_trgm_ops);

CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_station_id ON public.profiles (station_id);

CREATE INDEX idx_reports_location_gist ON public.reports USING GIST (location);
CREATE INDEX idx_reports_area_name_trgm ON public.reports USING GIN (area_name gin_trgm_ops);
CREATE INDEX idx_reports_reporter_id ON public.reports (reporter_id);
CREATE INDEX idx_reports_status_created_at ON public.reports (status, created_at DESC);
CREATE INDEX idx_reports_flag_suspicion ON public.reports (flag_status, suspicion_score DESC);

CREATE INDEX idx_report_corroborations_report_id ON public.report_corroborations (report_id);
CREATE INDEX idx_report_corroborations_user_id ON public.report_corroborations (user_id);
CREATE INDEX idx_report_corroborations_loc_gist ON public.report_corroborations USING GIST (user_location);

CREATE INDEX idx_report_tips_report_id ON public.report_tips (report_id, created_at ASC);
CREATE INDEX idx_report_tips_author_id ON public.report_tips (author_id);

CREATE INDEX idx_distress_signals_location_gist ON public.distress_signals USING GIST (location);
CREATE INDEX idx_distress_signals_user_id ON public.distress_signals (user_id);
CREATE INDEX idx_distress_signals_status_triggered ON public.distress_signals (status, triggered_at DESC);

CREATE INDEX idx_safe_walks_user_status ON public.safe_walks (user_id, status);
CREATE INDEX idx_safe_walks_last_loc_gist ON public.safe_walks USING GIST (last_known_location);

CREATE INDEX idx_shift_handovers_station_created ON public.shift_handovers (station_id, created_at DESC);
CREATE INDEX idx_criminals_status_risk ON public.criminals (status, risk_level);
CREATE INDEX idx_criminals_location_gist ON public.criminals USING GIST (last_known_location);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Private Security Helpers & Integrity Triggers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN NULL
    ELSE (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  END;
$$;

REVOKE EXECUTE ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.resolve_public_author_name(target_uid uuid, is_anon boolean)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'Anonymous Citizen'
    WHEN is_anon
      AND target_uid <> (SELECT auth.uid())
      AND COALESCE((SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid())), 'citizen') NOT IN ('police', 'admin')
      THEN 'Anonymous Citizen'
    ELSE COALESCE((SELECT p.full_name FROM public.profiles p WHERE p.id = target_uid), 'Daak Citizen')
  END;
$$;

REVOKE EXECUTE ON FUNCTION private.resolve_public_author_name(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resolve_public_author_name(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'Daak Citizen'),
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

CREATE OR REPLACE FUNCTION private.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Allow superuser / service_role / migrations (when auth.uid() is NULL and not an authenticated user)
  IF (SELECT auth.uid()) IS NULL OR caller_jwt_role = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.credibility_score IS DISTINCT FROM OLD.credibility_score
    OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
    OR NEW.is_demo_account IS DISTINCT FROM OLD.is_demo_account THEN
    IF COALESCE(private.current_user_role(), 'citizen') <> 'admin' THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE: Only service_role or admin may modify protected profile fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_profile_privilege_escalation();

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_safe_walks_updated_at BEFORE UPDATE ON public.safe_walks FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_criminals_updated_at BEFORE UPDATE ON public.criminals FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Enable Default-Deny RLS on All 10 Tables
-- ----------------------------------------------------------------------------

ALTER TABLE public.police_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_corroborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distress_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- police_stations
CREATE POLICY "police_stations_select_authenticated"
  ON public.police_stations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "police_stations_admin_write"
  ON public.police_stations FOR ALL TO authenticated
  USING ((select private.current_user_role()) = 'admin')
  WITH CHECK ((select private.current_user_role()) = 'admin');

-- profiles
CREATE POLICY "profiles_select_own_or_staff"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = id
    OR (select private.current_user_role()) IN ('police', 'admin')
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- reports
CREATE POLICY "reports_select_visible"
  ON public.reports FOR SELECT TO authenticated
  USING (
    status IN ('verified', 'investigating', 'resolved')
    OR reporter_id = (select auth.uid())
    OR (select private.current_user_role()) IN ('police', 'admin')
  );

CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = (select auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "reports_update_staff"
  ON public.reports FOR UPDATE TO authenticated
  USING ((select private.current_user_role()) IN ('police', 'admin'))
  WITH CHECK ((select private.current_user_role()) IN ('police', 'admin'));

CREATE POLICY "reports_delete_admin"
  ON public.reports FOR DELETE TO authenticated
  USING ((select private.current_user_role()) = 'admin');

-- report_corroborations
CREATE POLICY "corroborations_select_visible"
  ON public.report_corroborations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id
        AND (
          r.status IN ('verified', 'investigating', 'resolved')
          OR r.reporter_id = (select auth.uid())
          OR (select private.current_user_role()) IN ('police', 'admin')
        )
    )
  );

CREATE POLICY "corroborations_insert_own"
  ON public.report_corroborations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND distance_meters <= 1000
  );

CREATE POLICY "corroborations_delete_admin"
  ON public.report_corroborations FOR DELETE TO authenticated
  USING ((select private.current_user_role()) = 'admin');

-- report_tips
CREATE POLICY "report_tips_select_visible"
  ON public.report_tips FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id
        AND (
          r.status IN ('verified', 'investigating', 'resolved')
          OR r.reporter_id = (select auth.uid())
          OR (select private.current_user_role()) IN ('police', 'admin')
        )
    )
  );

CREATE POLICY "report_tips_insert_own"
  ON public.report_tips FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()));

CREATE POLICY "report_tips_delete_own_or_admin"
  ON public.report_tips FOR DELETE TO authenticated
  USING (
    author_id = (select auth.uid())
    OR (select private.current_user_role()) = 'admin'
  );

-- distress_signals
CREATE POLICY "distress_select_own_or_staff"
  ON public.distress_signals FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (select private.current_user_role()) IN ('police', 'admin')
  );

CREATE POLICY "distress_insert_own"
  ON public.distress_signals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND status = 'active'
  );

CREATE POLICY "distress_update_cancel_own"
  ON public.distress_signals FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND status = 'active')
  WITH CHECK (user_id = (select auth.uid()) AND status = 'cancelled');

CREATE POLICY "distress_update_staff"
  ON public.distress_signals FOR UPDATE TO authenticated
  USING ((select private.current_user_role()) IN ('police', 'admin'))
  WITH CHECK ((select private.current_user_role()) IN ('police', 'admin'));

-- safe_walks
CREATE POLICY "safe_walks_select_own_or_escalated_staff"
  ON public.safe_walks FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR ((select private.current_user_role()) = 'police' AND status = 'escalated')
    OR (select private.current_user_role()) = 'admin'
  );

CREATE POLICY "safe_walks_insert_own"
  ON public.safe_walks FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "safe_walks_update_own"
  ON public.safe_walks FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- shift_handovers
CREATE POLICY "shift_handovers_select_staff"
  ON public.shift_handovers FOR SELECT TO authenticated
  USING ((select private.current_user_role()) IN ('police', 'admin'));

CREATE POLICY "shift_handovers_insert_staff"
  ON public.shift_handovers FOR INSERT TO authenticated
  WITH CHECK (
    outgoing_officer_id = (select auth.uid())
    AND (select private.current_user_role()) IN ('police', 'admin')
  );

CREATE POLICY "shift_handovers_admin_manage"
  ON public.shift_handovers FOR ALL TO authenticated
  USING ((select private.current_user_role()) = 'admin')
  WITH CHECK ((select private.current_user_role()) = 'admin');

-- criminals
CREATE POLICY "criminals_select_public_or_staff"
  ON public.criminals FOR SELECT TO authenticated
  USING (
    status IN ('wanted', 'in_custody')
    OR (select private.current_user_role()) IN ('police', 'admin')
  );

CREATE POLICY "criminals_admin_write"
  ON public.criminals FOR ALL TO authenticated
  USING ((select private.current_user_role()) = 'admin')
  WITH CHECK ((select private.current_user_role()) = 'admin');

-- activity_logs (immutable append-only via service_role/FastAPI)
CREATE POLICY "activity_logs_select_staff"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    (select private.current_user_role()) = 'admin'
    OR ((select private.current_user_role()) = 'police' AND actor_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 5. Privacy-Preserving Public Views (security_invoker = true)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_reports_view
WITH (security_invoker = true) AS
SELECT
  r.id,
  CASE
    WHEN r.is_anonymous_public
      AND r.reporter_id <> (SELECT auth.uid())
      AND COALESCE((SELECT private.current_user_role()), 'citizen') NOT IN ('police', 'admin')
      THEN NULL
    ELSE r.reporter_id
  END AS reporter_id,
  private.resolve_public_author_name(r.reporter_id, r.is_anonymous_public) AS reporter_display_name,
  r.is_anonymous_public,
  r.category,
  r.severity,
  r.title,
  r.description,
  r.area_name,
  r.address_text,
  ST_Y(r.location::geometry) AS lat,
  ST_X(r.location::geometry) AS lng,
  r.occurred_at,
  r.media_urls,
  r.status,
  r.corroboration_count,
  r.created_at,
  r.updated_at
FROM public.reports r;

CREATE OR REPLACE VIEW public.public_tips_view
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.report_id,
  CASE
    WHEN t.is_anonymous_public
      AND t.author_id <> (SELECT auth.uid())
      AND COALESCE((SELECT private.current_user_role()), 'citizen') NOT IN ('police', 'admin')
      THEN NULL
    ELSE t.author_id
  END AS author_id,
  private.resolve_public_author_name(t.author_id, t.is_anonymous_public) AS author_display_name,
  t.is_anonymous_public,
  t.body,
  t.created_at
FROM public.report_tips t;

GRANT SELECT ON public.public_reports_view TO authenticated;
GRANT SELECT ON public.public_tips_view TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Storage Buckets & Policies + Realtime Publication
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('evidence-media', 'evidence-media', false),
  ('criminal-photos', 'criminal-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidence_media_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-media'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "evidence_media_select_own_or_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence-media'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (select private.current_user_role()) IN ('police', 'admin')
    )
  );

CREATE POLICY "evidence_media_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidence-media'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "criminal_photos_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'criminal-photos');

CREATE POLICY "criminal_photos_admin_write"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'criminal-photos'
    AND (select private.current_user_role()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'criminal-photos'
    AND (select private.current_user_role()) = 'admin'
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.distress_signals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.safe_walks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lock down PostGIS spatial_ref_sys if owned by role, ignore cleanly if superuser-owned
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
