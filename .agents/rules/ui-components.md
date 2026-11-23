---
trigger: glob
globs: "apps/web/src/**/*.tsx, apps/mobile/src/**/*.tsx"
description: Visual standards, accessibility, and DESIGN.md token adherence for Daak v2 UI components.
---

# UI Component Standards (Daak v2 — Dhaka Civic Dispatch)
- Derive all colors, surfaces, borders, and typography from `DESIGN.md` tokens (`#F6F7F4` Civic Chalk, `#11171A` Monsoon Slate, `#0F514A` Dhaka Civic Teal, `#C81E2B` Emergency Crimson strictly for SOS/SLA breaches). Never introduce unvetted hardcoded hexes or neon dark-mode gradients.
- Keep Emergency Crimson strictly semantic (SOS, countdown cancel, active distress, SLA breach `>10m`) — never decorative.
- Prevent generic template patterns: no ALL-CAPS tracked eyebrows above headings, no uniform shadow-heavy SaaS card grids, no decorative page-load stagger animations.
- Web (`apps/web`): `Public Sans` + `JetBrains Mono` (coordinates, case IDs, `MM:SS` timers only) with `tabular-nums`; visible `:focus-visible` outlines, keyboard navigation, semantic landmarks, and explicit `<label>` elements.
- Mobile (`apps/mobile`): Native OS typography (`Roboto` Material 3 / `SF Pro` HIG), minimum `48x48 dp` / `44x44 pt` touch targets with `>= 8 dp` spacing, edge-to-edge safe areas, and `prefers-reduced-motion` support.
- Every view and panel must implement all 5 UI states: Loading (skeletons), Empty (actionable), Success, Partial Error, and Fatal Error.
