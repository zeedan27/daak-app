# DESIGN.md — Daak v2 Visual System ("Dhaka Civic Dispatch & Municipal Enamel")

> Single source of truth for visual tokens, typography, layout structure, native platform rules, and interaction states across `apps/web` (Police & Admin Desktop) and `apps/mobile` (Citizen Mobile + Expo Web Preview). Note: `.impeccable/design.json` will be generated/synced from the built implementation via `impeccable document` in Phase 3/4.

---

## 1. Visual World & Concept Seed Provenance
- **Mode:** `operate` (both surfaces — users are completing urgent civic safety, dispatch, and moderation tasks).
- **Seed Reference:** `seed:4d73b1a176a6c703` (Assigned Grounded Candidate #3).
- **World Concept:** **Dhaka Civic Dispatch & Municipal Enamel** — modeled after high-legibility civic wayfinding signage, Dhaka municipal/postal authority teal-green, daylight-first chalk surfaces, and true monsoon-slate dark mode, with strict semantic emergency crimson reserved exclusively for live distress and SLA breaches.
- **Challenger Weighing & Discipline Raises:**
  - *Competitive (`wayfinding-cartography-signage-midnight-transit-diagram`):* Adopted disciplined corridor/interchange clarity and crisp station ticks for Safe Walk routing and Dhaka Thana markers.
  - *Competitive (`japanese-high-density-web`):* Adopted compact hairline-ruled operational density and tight filter bars so Police dispatchers scan active incidents without SaaS card bloat.
  - *Declined (`crouwel-grid-specimen`, `variable-font-specimen`, `vernacular-ephemera-cassette-j-card`, `pop-culture-shelf-streaming-title-card-wall`):* Raised structural grid alignment across desktop dispatch seams (`crouwel-grid-specimen`) and crisp numeric scale contrast for live timers/coordinates (`variable-font-specimen`), rejecting aesthetic costume elements.

---

## 2. Two-Pass Calibration & Anti-Slop Audit (Frontend-Design Self-Critique)
- **Rejected Generic Defaults (Pass 1 → Pass 2 Revisions):**
  1. *Rejected dark-mode neon "cyber ops" palette:* Replaced `#0B0B0B` + glowing cyan/neon accents with daylight-first `Civic Chalk` (`#F6F7F4`) paired with a committed `Dhaka Civic Teal` (`#0F514A`) command rail and a true, non-inverted `Monsoon Slate` (`#11171A`) dark mode for night dispatch and outdoor mobile use.
  2. *Rejected banned template typography (`IBM Plex`, `Space Grotesk`, `DM Sans`, `Inter-as-display`):* Selected `Public Sans` (government/civic public-infrastructure readability) + `JetBrains Mono` strictly for GPS coordinates, case IDs, and live `MM:SS` SLA counters on web, and native OS system stacks (`Roboto` Material 3 / `SF Pro` HIG) on mobile.
  3. *Rejected generic rounded SaaS 3-card grids & decorative chrome:* Replaced shadow-heavy card stacks with hairline-ruled split-decks, an inline collapsible right case-inspector drawer (instead of lazy modals), and ALL-CAPS eyebrow labels eliminated in favor of sentence-case semantic labels.
  4. *Rejected burying SOS behind confirmation modals:* Replaced multi-step popups with a direct tactile Hold/Tap SOS Panic Ring with an in-place 5-second cancel countdown.

---

## 3. Color System (Named Semantic Tokens)

### Light Theme (Daylight / Municipal Chalk — Default)
| Token | Hex | Role |
|---|---|---|
| `--bg-canvas` | `#F6F7F4` | **Civic Chalk** — primary application ground |
| `--bg-surface` | `#FFFFFF` | Elevated cards, tables, inspector drawers |
| `--bg-rail-light` | `#ECEFEB` | **Soft Mineral** — secondary panels, filter bars |
| `--bg-rail-committed` | `#0F514A` | **Dhaka Civic Teal** — committed desktop nav rail & primary authority buttons |
| `--ink-primary` | `#131C1E` | High-contrast body and heading ink (`> 12:1` on Chalk) |
| `--ink-secondary` | `#4B5B5E` | Metadata, secondary labels, timestamps |
| `--border-hairline` | `#D5DDD9` | 1px structural rules and table seams |
| `--signal-emergency` | `#C81E2B` | **Emergency Crimson** — STRICTLY SOS button, active distress, SLA breach (`>10m`) |
| `--signal-warning` | `#B45309` | **Signal Amber** — pending moderation, SLA caution (`5–10m`) |
| `--signal-safe` | `#15803D` | **Civic Emerald** — resolved cases, high safety score (`>= 75`), verified status |
| `--signal-info` | `#0E7490` | **River Cyan** — active Safe Walk beacon, dispatch unit en route |

### Dark Theme (Monsoon Slate — First-Class Scheme)
| Token | Hex | Role |
|---|---|---|
| `--bg-canvas-dark` | `#11171A` | **Monsoon Slate** — primary night canvas |
| `--bg-surface-dark` | `#182126` | Elevated panels, sheets, inspector drawers |
| `--bg-rail-dark` | `#0C1114` | Deep rail and bottom navigation surface |
| `--accent-primary-dark` | `#2DD4BF` | Interactive focus, active nav indicator, verified highlights |
| `--ink-primary-dark` | `#EEF2F1` | Primary text ink |
| `--ink-secondary-dark` | `#9EB0B3` | Secondary text ink |
| `--border-hairline-dark` | `#26343A` | 1px structural seams |
| `--signal-emergency-dark` | `#F87171` | Active SOS & SLA breach text/border (paired with `#7F1D1D` fill for SOS ring) |
| `--signal-warning-dark` | `#FBBF24` | SLA caution / flagged reports |
| `--signal-safe-dark` | `#4ADE80` | Resolved / safe threshold |

*Rule:* Emergency Crimson (`#C81E2B` / `#F87171`) is **never** used for generic brand decoration, primary CTAs on non-emergency forms, or marketing badges.

---

## 4. Typography & Scale

### Desktop Web (`apps/web`)
- **Primary UI Face:** `Public Sans` (weights `400`, `500`, `600`, `700`) — all navigation, headings, tables, buttons, and prose.
- **Technical Mono Face:** `JetBrains Mono` (weights `400`, `500`) — strictly for GPS coordinates (`23.7461, 90.3742`), case IDs (`SOS-4821`), and `MM:SS` SLA chronometers. Never used for section eyebrows.
- **Fixed `rem` Scale (Operate Tight Ratio ~1.15–1.2):**
  - `h1` Page Title: `1.5rem` (`24px`), `600`, line-height `1.25`
  - `h2` Panel Header: `1.125rem` (`18px`), `600`, line-height `1.3`
  - `body` / Table Primary: `0.875rem` (`14px`), `400`, line-height `1.5`, max prose measure `70ch`
  - `caption` / Metadata: `0.75rem` (`12px`), `500`, sentence case (NO all-caps labels)
  - Numeric alignment: `font-variant-numeric: tabular-nums` mandatory on all scores, counts, and timers.

### Citizen Mobile (`apps/mobile`)
- **Android:** Material Design 3 system scale using `Roboto` and `sp` units (respects system `font_scale` up to `1.3x+` without clipping).
- **iOS:** Apple HIG Dynamic Type roles (`Title 2`, `Headline`, `Body 17pt`, `Subheadline`, `Footnote`, minimum floor `11pt`) using `SF Pro`.
- **Tabular Numerals:** Enabled on countdown timers, Safety Score (`0–100`), and distance-to-Thana readouts.

---

## 5. Layout Architecture & Wireframes

### A. Citizen Mobile (`apps/mobile` — Portrait `390x844` Baseline + Expo Web Mobile Frame)
Left-aligned content hierarchy inside edge-to-edge safe areas; minimum `48x48 dp` (Android) / `44x44 pt` (iOS) touch targets with `>= 8 dp` spacing; 4-tab native bottom bar (`Home`, `Map`, `Reports`, `DaakAI`).

```text
+--------------------------------------+
| Dhanmondi, Dhaka      Safety: 78 [v] |  <- Area + Safety Score + Demo Switcher
+--------------------------------------+
| [SAFE WALK: Dhanmondi -> TSC  14:20] |  <- Active Beacon Strip (when running)
|                                      |
|          (   HOLD / TAP   )          |
|          (   S O S  999   )          |  <- Primary Emergency Ring (#C81E2B)
|          ( 5s cancel ring )          |     Tactile, zero-modal countdown
|                                      |
| [ + Report Crime ]  [ Start Walk ]   |  <- 48dp+ dual quick actions
+--------------------------------------+
| Nearby Reports (within 2 km)         |
| ------------------------------------ |
| Snatching · Kalabagan · 12m ago      |  <- Hairline-ruled incident row
| [ I Saw This Too (3) ]   [ Details ] |  <- 1km PostGIS corroboration CTA
| ------------------------------------ |
| Streetlight Out · Road 27 · 1h ago   |
+--------------------------------------+
| [Home]   [Map]   [Reports]  [DaakAI] |  <- Native Tab Bar / Material Nav Bar
+--------------------------------------+
```

### B. Police & Admin Desktop Web (`apps/web` — `1440x900` Split-Deck)
3-zone structural layout: fixed `220px` Dhaka Civic Teal navigation rail (collapses to drawer on `< 1024px`), central Split-Deck (top map + sortable tabular queue), and collapsible `380px` right Case Inspector drawer (zero modals for routine triage).

```text
+---------------+-----------------------------------------+----------------------+
| DAAK DISPATCH | Live SOS Monitor     [Demo: Police v]   | CASE #SOS-4821   [x] |
|---------------|-----------------------------------------|----------------------|
| * SOS Monitor | [Active: 3] [Claimed: 2] [Avg SLA 04:12]| Citizen: Anon/Masked |
|   Reports     |-----------------------------------------| Area: Mirpur-10      |
|   Heatmap     |                                         | Nearest Thana:       |
|   Handovers   |      [ Interactive Dhaka PostGIS ]      | Pallabi PS (0.8 km)  |
|---------------|      [   SOS & Report Map View   ]      |                      |
| ADMIN         |                                         | Timeline:            |
|   False Queue |-----------------------------------------| 17:02 SOS Triggered  |
|   Criminals   | ID    Area      Trigger   SLA    Action | 17:03 Unit Assigned  |
|   Analytics   | 4821  Mirpur-10 Panic     02:14 [Claim] |                      |
|   Audit Logs  | 4819  Uttara-7  SafeWalk  06:40 [Resp.] | [ Assign Unit ]      |
|               | 4812  Jatrabari Panic     11:05 [Alert] | [ Mark Resolved ]    |
+---------------+-----------------------------------------+----------------------+
```

---

## 6. Signature Moves, Motion & Accessibility Rules

1. **Signature Move #1 (Mobile): Tactile SOS 5-Second Ring + Persistent Safe Walk Beacon**
   - Tapping/holding SOS opens an in-place circular 5-second countdown with haptic feedback (on native) and a single `48dp+` "Cancel SOS" stop button before transmission.
2. **Signature Move #2 (Desktop): Live SLA Chronometer Pills & Map-Queue Sync**
   - Every active SOS row renders a live `MM:SS` monospace chronometer shifting cleanly across semantic tiers (`< 5m` Teal → `5–10m` Signal Amber → `> 10m` Emergency Crimson). Clicking a row centers the map and opens the right Inspector Drawer.
3. **Motion Rules:**
   - Duration: `150ms–250ms` state transitions only (drawer slide, SOS ring progress, status chip update).
   - Zero decorative page-load stagger animations or bounce effects.
   - Must respect `prefers-reduced-motion` (web) and `AccessibilityInfo.isReduceMotionEnabled` (Expo) with instant state swaps.
4. **WCAG & Native Ergonomics:**
   - Visible `:focus-visible` outlines (`2px solid #0F514A` light / `#2DD4BF` dark) on all web interactive elements.
   - Explicit `<label>` associations on all forms; semantic `<nav>`, `<main>`, `<aside>`, `<table>` markup.

---

## 7. UX Copy & 5-State Completeness Contract

- **Copy Tone:** Active voice, sentence case, plain verbs (`Claim alert`, `Mark resolved`, `Corroborate nearby`, `Hide my name publicly`). No generic `"Submit"`, no apologetic error prose, no fabricated metrics, and clear synthetic-data notice (`"Demo dataset — simulated Bangladesh incidents & dispatch"`).
- **Mandatory 5 UI States (Every Screen & Panel):**
  1. **Loading:** Structural skeletons matching row/map dimensions (never unstyled centered spinners blocking whole panels; explicit cold-start reassurance if FastAPI takes `> 2s` on free tier).
  2. **Empty:** Actionable guidance inviting the next step (e.g., `"No active SOS signals right now. Switch to Demo Citizen or trigger a test SOS to see live dispatch."`).
  3. **Success:** Crisp inline confirmation / snackbar matching the trigger verb (`"Alert claimed"`, `"Report published"`).
  4. **Partial Error:** Degraded data banner retaining rendered map/cached list with targeted retry button (e.g., `"Safety score unavailable — showing latest reports. Retry"`).
  5. **Fatal Error:** Plain diagnostic state explaining what failed and offering safe recovery (`Reload panel` / `Sign in again`).
