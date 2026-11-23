# Daak v2 — Findings, Constraints & Layer Decision Table

## 1. Local Environment (Verified Phase 0)
- **OS / Shell:** Windows (`pwsh`)
- **Git:** `git version 2.52.0.windows.1` (author configured: `Zesrab Tanjeel Khan <ztkhan000@gmail.com>`)
- **Node / npm:** `v26.13.0` / `11.20.0`
- **Python / uv:** `Python 3.14.2` / `uv 0.13.7`

## 2. Legacy Reference Notes (`D:\Projects\Daak\daak_final\Daak-main`)
Kept strictly read-only as a domain reference:
- Next.js 16 (JS-only) + Firebase/Firestore inline calls inside UI components.
- Domain modules worth referencing and redesigning cleanly in Phase 1/3: `safetyScore.js`, `falseReportDetection.js`, `chatbot.js`, `criminalDatabase.js`, `crimeAlerts.js`, Leaflet heatmap integration, and branding assets (`logo.png`, `daak-bg.png`).

## 3. User Creative Direction Mandate
- User explicitly granted creative design freedom for Daak v2 (adding, refining, or removing features) with a Bangladesh-focused, mobile-first citizen experience, desktop-first police & admin portal, and publicly demoable free-tier hosting.

## 4. Tooling & Skill Verification Inventory (Phase 0)
- **Installed Core / UI / Stack Skills:**
  - `scope`, `verification-before-completion`, `systematic-debugging`
  - `design-taste-frontend`, `frontend-design`, `impeccable`, `web-design-guidelines`, `vercel-react-best-practices`
  - `supabase`, `supabase-postgres-best-practices`, `workers-best-practices`, `wrangler`
- **Installed MCP Servers:**
  - `context7`, `supabase_mcp`, `cloudflare_cloudflare`
- **Missing Universal Core Skills (awaiting explicit user approval before install):**
  - `test-driven-development` → `npx skills add obra/superpowers --skill test-driven-development -g`
  - `requesting-code-review` → `npx skills add obra/superpowers --skill requesting-code-review -g`
- **Optional Conditional Skill (for Phase 3 if 3+ parallel slices):**
  - `subagent-driven-development` → `npx skills add obra/superpowers --skill subagent-driven-development -g`

## 5. 12-Layer Decision Table
*TBD in Phase 1 (Specification).*

| Layer | Status (Required / Lite / Deferred) | Selected Tech | Rationale | Revisit Trigger |
|---|---|---|---|---|
| 1 Frontend | | | | |
| 2 APIs & Backend | | | | |
| 3 Database & Storage | | | | |
| 4 Auth & Permissions | | | | |
| 5 Hosting & Deployment | | | | |
| 6 Cloud & Compute | | | | |
| 7 CI/CD & Version Control | | | | |
| 8 Security & RLS | | | | |
| 9 Rate Limiting | | | | |
| 10 Caching & CDN | | | | |
| 11 Load Balancing & Scaling | | | | |
| 12 Error Tracking & Logs | | | | |

## 6. Threat Model Sketch
*TBD in Phase 1 (required for T1+).*
