# Surface Brief: Citizen Mobile (`apps/mobile`)

- **Scope:** Citizen Mobile App (`apps/mobile` — Expo React Native for Android/iOS + Expo Web Preview)
- **Visitor Mode:** Operate (native mobile safety & emergency utility; `android.md` Material 3 + `ios.md` HIG guarantees)
- **Audience & Job:** Bangladesh citizens under stress, commuting, or checking local safety; triggers 5-sec cancelable SOS, starts Safe Walk timers, files reports (with optional public anonymity), corroborates nearby incidents ("I Saw This Too"), and queries Bangla/Banglish DaakAI.
- **Constraints:** Minimum `48x48 dp` / `44x44 pt` touch targets, edge-to-edge safe areas, daylight outdoor contrast + first-class Dark Mode, `prefers-reduced-motion` compliance, and synthetic demo data labels.
- **Unresolved Decisions:** Exact Expo Map provider fallback on web preview vs. Android APK (resolved in Phase 2/3 using `react-native-maps` on native + Leaflet/MapLibre fallback on Expo Web Preview).

## Direction contract

THESIS: A calm, daylight-legible civic safety instrument built on Dhaka Civic Dispatch & Municipal Enamel — putting an unmistakable 5-second cancelable SOS ring and persistent Safe Walk beacon one thumb-reach away without dark-mode neon theatrics or generic SaaS cards.

OWN-WORLD: Civic Chalk (`#F6F7F4`) ground and pure white elevated cards in daylight, Monsoon Slate (`#11171A`) in first-class dark mode, Dhaka Civic Teal (`#0F514A` / `#2DD4BF`) for primary navigation and verified controls, and Emergency Crimson (`#C81E2B` / `#F87171`) strictly reserved for SOS, countdown cancel, and active distress states. Native OS type (`Roboto` / `SF Pro`) with tabular numerals on coordinates and timers.

STORY: A citizen opens the app and immediately sees their neighborhood's current safety score, nearest Thana distance, any active Safe Walk beacon, and the tactile SOS trigger; within two taps they can summon help, corroborate a nearby report within 1 km, or ask DaakAI in Bangla, Banglish, or English.

FIRST VIEWPORT: Top native context header with current Thana/area + Safety Score badge and quick Demo Role switcher; central high-contrast Hold/Tap SOS Panic Ring paired with a one-tap Safe Walk timer strip; below the fold, nearby verified reports with "I Saw This Too" distance-gated actions; anchored by a 4-tab native bottom bar (`Home`, `Map`, `Reports`, `DaakAI`).

FORM: Grounded candidate #3 ("Dhaka Civic Dispatch & Municipal Enamel") from the 7-world operate derivation, raised by `wayfinding-cartography-signage-midnight-transit-diagram` (crisp corridor/interchange clarity for Safe Walk and Thana routing) and `japanese-high-density-web` (hairline-ruled scannable incident rows with zero wasted padding); `seed:4d73b1a176a6c703`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
