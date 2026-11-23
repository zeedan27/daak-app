# Surface Brief: Police & Admin Desktop Command Web (`apps/web`)

- **Scope:** Police & Admin Desktop Web Portal (`apps/web` — Next.js App Router)
- **Visitor Mode:** Operate (desktop dispatch, spatial monitoring, moderation, and audit console)
- **Audience & Job:** Police dispatchers monitoring live SOS signals with SLA chronometers, verifying reports, and writing shift handovers; Admins triaging 5-factor false-report queues, managing the criminal watchlist, and auditing activity logs.
- **Constraints:** Desktop-first 3-zone command workspace (collapsing gracefully on smaller viewports), WCAG 2.1 AA contrast, full keyboard navigation + `:focus-visible`, tabular numerals on SLA timers/scores/coordinates, zero lazy modal-first flows (use inline right inspector drawer).
- **Unresolved Decisions:** Interactive map tile provider in `apps/web` (Leaflet + OpenStreetMap / Carto tiles with `leaflet.heat` matching Bangladesh coordinates, vetted in Phase 2/3).

## Direction contract

THESIS: An authoritative municipal dispatch deck that replaces generic dark cyber-dashboards with Dhaka Civic Dispatch & Municipal Enamel — organizing live SOS signals, PostGIS heatmaps, and false-report triage into a hairline-ruled three-zone workspace where urgency is encoded by live SLA chronometers rather than decorative chrome.

OWN-WORLD: Committed Dhaka Civic Teal (`#0F514A`) left navigation rail (`220px`) against a Civic Chalk (`#F6F7F4`) / Monsoon Slate (`#11171A` dark) workspace canvas, hairline `#D5DDD9` / `#26343A` structural dividers, Signal Amber (`#B45309`) SLA warnings, Civic Emerald (`#15803D`) resolved states, and Emergency Crimson (`#C81E2B`) reserved strictly for active SOS alerts and SLA breaches. `Public Sans` UI typography with `JetBrains Mono` strictly for GPS coordinates, case IDs, and `MM:SS` SLA counters.

STORY: A dispatcher or demo evaluator signs in with one click, immediately sees active SOS signals sorted by SLA urgency alongside a live Bangladesh spatial map, claims and assigns a patrol unit from the inline right inspector drawer without losing map context, and logs shift handovers or moderates flagged reports cleanly.

FIRST VIEWPORT: Left `220px` Dhaka Civic Teal navigation rail (`SOS Monitor`, `Reports`, `Heatmap`, `Handovers`, plus Admin sections `False Reports`, `Criminals`, `Analytics`, `Audit Logs`); center split-deck showing top live KPI strip + interactive Bangladesh incident/SOS map over a sortable tabular dispatch queue with live `MM:SS` SLA pills; collapsible right case-inspector drawer showing reporter context, distance to nearest Thana, media evidence, and dispatch timeline.

FORM: Grounded candidate #3 ("Dhaka Civic Dispatch & Municipal Enamel") from the 7-world operate derivation, raised by `japanese-high-density-web` (compact hairline-ruled tabular density and non-wasteful filter bars) and `crouwel-grid-specimen` (strict structural grid alignment across KPIs, table cells, and drawer seams); `seed:4d73b1a176a6c703`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
