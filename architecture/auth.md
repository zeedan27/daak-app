# SOP: Authentication & Role Resolution

## 1. Goal & Scope
Enforce verifiable role-based identity (`citizen`, `police`, `admin`) across Supabase Auth, FastAPI, Next.js Desktop Web, and Expo Citizen Mobile.

## 2. Role Source of Truth
- **Never** trust `raw_user_meta_data` (`user_metadata`) for authorization decisions.
- Authoritative user roles live solely in `public.profiles.role` (`CHECK (role IN ('citizen', 'police', 'admin'))`).
- On `auth.users` signup, `private.handle_new_user()` creates a `public.profiles` row hardcoded to `'citizen'`.

## 3. Demo Mode Accounts (`DEMO_MODE=true`)
- Seeded portfolio demo accounts:
  - Citizen: `demo.citizen@daak.bd` (`11111111-1111-4111-8111-111111111101`)
  - Police: `demo.police@daak.bd` (`11111111-1111-4111-8111-111111111102`)
  - Admin: `demo.admin@daak.bd` (`11111111-1111-4111-8111-111111111103`)
- FastAPI supports both Supabase Bearer JWTs and demo tokens when `DEMO_MODE=true`; in production (`DEMO_MODE=false`), `POST /api/v1/auth/demo-login` returns `403`.
