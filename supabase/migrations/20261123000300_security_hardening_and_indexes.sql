-- ============================================================================
-- Daak v2 — Security Hardening, View Privacy Masking & Missing FK Indexes
-- Migration: 20261123000300_security_hardening_and_indexes
-- ============================================================================

-- 1. Add user-scoped SOS idempotency column & unique partial index
ALTER TABLE public.distress_signals
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_distress_signals_user_idempotency
  ON public.distress_signals (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Add missing FK B-tree indexes
CREATE INDEX IF NOT EXISTS idx_reports_assigned_officer_id ON public.reports (assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_distress_signals_claimed_by ON public.distress_signals (claimed_by);
CREATE INDEX IF NOT EXISTS idx_safe_walks_escalated_sos_id ON public.safe_walks (escalated_sos_id);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_outgoing_officer ON public.shift_handovers (outgoing_officer_id);
CREATE INDEX IF NOT EXISTS idx_criminals_created_by ON public.criminals (created_by);

-- 3. Fix public_reports_view & public_tips_view so reporter_id / author_id is NEVER
--    exposed to non-owner citizens even when is_anonymous_public = false.
CREATE OR REPLACE VIEW public.public_reports_view
WITH (security_invoker = true) AS
SELECT
  r.id,
  CASE
    WHEN r.reporter_id = (SELECT auth.uid())
      OR COALESCE((SELECT private.current_user_role()), 'citizen') IN ('police', 'admin')
      THEN r.reporter_id
    ELSE NULL
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
    WHEN t.author_id = (SELECT auth.uid())
      OR COALESCE((SELECT private.current_user_role()), 'citizen') IN ('police', 'admin')
      THEN t.author_id
    ELSE NULL
  END AS author_id,
  private.resolve_public_author_name(t.author_id, t.is_anonymous_public) AS author_display_name,
  t.is_anonymous_public,
  t.body,
  t.created_at
FROM public.report_tips t;

-- 4. Lock down direct authenticated INSERT on report_corroborations
--    (must go through FastAPI / service_role for ST_DWithin <= 1km & non-self verification)
ALTER POLICY "corroborations_insert_own" ON public.report_corroborations WITH CHECK (false);

-- 5. Lock criminal-photos bucket to authenticated access & allow admin delete on evidence-media
UPDATE storage.buckets SET public = false WHERE id = 'criminal-photos';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'evidence_media_admin_delete'
  ) THEN
    CREATE POLICY "evidence_media_admin_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'evidence-media'
        AND (select private.current_user_role()) = 'admin'
      );
  END IF;
END $$;
