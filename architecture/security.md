# SOP: Security, RLS & Secret Hygiene

## 1. Goal & Scope
Maintain default-deny data isolation, prevent horizontal/vertical privilege escalation, and protect private evidence media and API secrets.

## 2. RLS & Database Security Rules
- Enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) on all 10 tables in `public`.
- Wrap `auth.uid()` in `(select auth.uid())` inside RLS policies for plan caching; never use deprecated `auth.role()`.
- Place `SECURITY DEFINER` role lookup helpers inside the non-exposed `private` schema (`private.current_user_role()`) with `SET search_path = ''` and revoke `EXECUTE` from `PUBLIC` and `anon`.
- Block self-elevation via `BEFORE UPDATE ON public.profiles` trigger (`private.prevent_profile_privilege_escalation()`) rejecting edits to `role`, `credibility_score`, `is_verified`, or `is_demo_account` by non-admins/non-`service_role`.

## 3. Storage & Logging Hygiene
- `evidence-media` bucket is private (`public = false`); objects live under `{uid}/*` and are accessed via short-lived signed URLs for the owner, `police`, or `admin`.
- Structured JSON logs in FastAPI pass through `redact_sensitive_data()` before output so Bearer tokens, `service_role` keys, and AI keys never reach stdout/stderr.
