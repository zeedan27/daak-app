# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

delegated: Expo (React Native + TypeScript + Expo Web Preview) for the Citizen Mobile surface (`apps/mobile`); Next.js (App Router + TypeScript) for the Police & Admin Desktop Web Portal (`apps/web`); Python FastAPI for the domain API (`apps/api`); and Supabase (PostgreSQL + PostGIS + Auth + Storage + Realtime) for persistence, geospatial queries, media storage, and live dispatch streams. Hosted on free-tier platforms (Vercel, Render or Railway, Supabase Cloud, and Expo EAS Build).

## Users

1. **Citizens in Bangladesh (commuters, students, families):** Need fast, high-stress emergency distress signaling (SOS and Safe Walk escort timers), local safety awareness, quick incident reporting with optional public anonymity, and Bangla/Banglish-friendly safety guidance on mobile — often one-handed, outdoors, or under low signal.
2. **Police Dispatchers & Field Officers:** Need an unmistakable desktop command interface showing incoming SOS alerts with live SLA response chronometers, geospatial incident clusters, report verification workflows, unit dispatch, and shift handovers.
3. **Platform Administrators:** Need automated false-report heuristic triage, report moderation, criminal watchlist management, operational analytics, and immutable audit logs.
4. **Portfolio & Demo Evaluators:** Need frictionless 1-click demo login across Citizen, Police, and Admin roles (including both an Android `.apk` build and a browser-based Expo Web Preview alongside the Police/Admin desktop portal) pre-populated with realistic Bangladesh demo incidents.

## Product Purpose

Daak v2 ("Daak" — Bengali for *a call for help*) bridges the gap between everyday citizen safety in Bangladesh and organized emergency dispatch. Success means a citizen can trigger a verifiable distress signal or check neighborhood safety within seconds on mobile, while police dispatchers immediately see live spatial context, SLA urgency, and community-corroborated reports on desktop without false-report noise drowning out real emergencies.

## Positioning

Unlike generic global SOS buttons or static crime forms, Daak v2 is purpose-built for Bangladesh's urban and semi-urban reality: it combines PostGIS spatial safety scoring and 1 km community corroboration ("I Saw This Too") with Bangla/Banglish-aware AI triage (`DaakAI`) + nearest Thana (police station) lookup, Safe Walk auto-escalation, and a live Police SLA & Shift Handover command desk.

## Operating Context

- **Dual-Surface Operations:** Citizens operate primarily on handheld phones (and in a mobile-framed Expo Web Preview for online demo reviewers); Police and Admin operate on desktop monitors in dispatch/moderation rooms.
- **Bangladesh Geography & Language:** Coordinates centered on Bangladesh (Dhaka Metro divisions such as Dhanmondi, Mirpur, Mohammadpur, Uttara, Gulshan, Motijheel, plus Chattogram, Sylhet, Rajshahi, Khulna). UI is crisp English for broad evaluation while area/Thana search and DaakAI understand Bangla (বাংলা) and romanized Banglish queries.
- **Demo Safety Boundary:** Publicly hosted demos simulate external 999 telephony/SMS dispatch with structured dispatch timeline records and clear UI notices ("Demo Mode — Simulated Dispatch") so reviewers can test end-to-end flows safely without triggering real emergency services.

## Capabilities and Constraints

- **Citizen Mobile (`apps/mobile`):**
  - Auth (signup, email verification, login, password reset) plus 1-click Demo Citizen login.
  - One-tap SOS Panic Button with 5-second cancelable countdown, GPS capture, battery/note metadata, and live status tracking (`active` → `claimed` → `responding` → `resolved`).
  - **Safe Walk / Escort Timer:** Citizen picks destination and expected arrival time; missed check-in automatically escalates to a live SOS distress signal.
  - Incident Reporting (category, severity, description, map pin/GPS, photo/video upload to private Storage, optional `"Hide My Name Publicly"` toggle).
  - **Community Corroboration ("I Saw This Too"):** Authenticated citizens within 1 km (verified server-side via PostGIS `ST_DWithin`) can corroborate a public report, raising trust and lowering false-report suspicion.
  - Interactive Crime Map & Heatmap + Area Safety Score (40% crime frequency, 35% resolution rate, 25% night/day weighting).
  - Public Reports & Alerts Feed with community tips/comments (respecting public anonymity).
  - **DaakAI Safety Assistant:** Bangla, Banglish, and English-aware safety chatbot grounded in recent PostGIS incidents and nearest Thana station lookup.
  - Emergency Contacts & Wanted/Criminal Watchlist Lookup.
- **Police Desktop Web (`apps/web/police`):**
  - Live SOS Monitor with Realtime updates, map view, live SLA response-time chronometer, claim/dispatch unit/respond/resolve workflow, and dispatch timeline.
  - Crime Report Review & Status Updates (`pending` → `verified` → `investigating` → `resolved` / `rejected`).
  - Police Crime Heatmap & Area Breakdown.
  - **Shift Handover Log:** Outgoing officers record open SOS references, priority Thana areas, and handover notes for the incoming shift.
- **Admin Desktop Web (`apps/web/admin`):**
  - Analytics Dashboard & Immutable Activity Logs.
  - Report Moderation & Automated 5-Factor False-Report Detection Queue (user credibility, duplicate/near-duplicate proximity, rapid submission spam, detail consistency, suspicious content).
  - Criminal Watchlist Database Management (CRUD).
- **Technical & Tier Constraints (`T1-Lite`):**
  - All user-owned tables enforce default-deny Row-Level Security (RLS).
  - Free-tier cold-start tolerance (FastAPI `/healthz/live` & `/healthz/ready`, graceful client loading/retry states).
  - Explicitly deferred until post-demo scale: real SMS/telco 999 integration, native background GPS geofencing daemon when app is force-killed, multi-region database replicas, and automated canary pipelines.

## Brand Commitments

- **Product Name:** `Daak` (Daak v2).
- **Legacy Reference Assets:** Existing branding graphics (`logo.png`, `daak-bg.png`) exist in `D:\Projects\Daak\daak_final\Daak-main\src\assets\images\` as optional visual references; new visual direction is authorized to redesign cleanly for Daak v2.
- **Voice:** Calm, plain-spoken, authoritative, and direct — active verbs, clear error recovery, zero sensationalism or fear-mongering.

## Evidence on Hand

- **Legacy Prototype (`D:\Projects\Daak\daak_final\Daak-main`):** Read-only reference containing Next.js 16 JS prototype, `safetyScore.js` weighting logic, `falseReportDetection.js` 5-factor heuristic scoring, `chatbot.js` prompt/location extractor, and police/admin panel structures.
- **Synthetic Demo Data:** No live production crime feed is connected; all initial seeded incidents, Thana locations, and criminal watchlist entries are synthetic Bangladesh demonstration records and will be explicitly labeled as synthetic demo data in the UI. Never invent real-world crime statistics, user counts, or police agency endorsements.

## Product Principles

1. **Speed Under Stress (Citizen):** Emergency actions (SOS, Safe Walk, 999 info) must stay one thumb-reach away with zero modal labyrinth.
2. **Signal Over Noise (Police & Admin):** Live SLA urgency, corroboration counts, and automated suspicion scores separate verified emergencies from spam.
3. **Privacy With Accountability:** Citizens can hide their identity from public feeds while preserving internal authenticated accountability for anti-abuse and Police follow-up.
4. **Deterministic Core, Assistive AI:** Geospatial safety scores, 1 km corroboration checks, and false-report scoring run deterministically in Python/PostGIS; LLMs assist with triage and guidance only.
5. **Demo-Ready Everywhere:** Any evaluator can test Citizen → FastAPI → Police Realtime flow end-to-end in under 60 seconds using 1-click demo accounts in browsers or on Android.

## Accessibility & Inclusion

- **Desktop Web:** WCAG 2.1 AA contrast compliance, full keyboard navigation, visible `:focus-visible` outlines, semantic landmarks, explicit form labels, and `tabular-nums` for live timers and coordinates.
- **Citizen Mobile:** Minimum `48x48 dp` (Android) / `44x44 pt` (iOS) touch targets with >= `8 dp` spacing, Dynamic Type / `sp` font scaling support, high-contrast outdoor daylight palette plus first-class Dark Mode, and `prefers-reduced-motion` / OS Reduce Motion compliance.
