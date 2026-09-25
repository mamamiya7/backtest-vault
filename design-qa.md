# Research workbench design QA

Date: 25 September 2026

Branch: `codex/vault-ui-redesign`

Final result: **passed** — scoped to the implemented UI and local sample journey.

## Target and method

The approved Momentify-aligned Vault preview is the visual target. It uses explicit setup, portfolio, strategy, entry and exit sections; three entry columns; inline Radar / Relative Strength / Builder; and a separate Market Trend window. The implementation retains the existing source model and application journey.

Compared the approved and implemented screenshots together in combined image inputs, including the full desktop page, filter/entry region, exit region and mobile page. Browser checks used Chrome at desktop width and a 375 × 812 CSS-pixel viewport. The full-page captures exclude the 15-pixel scrollbar. Fixture values differ from the reference; layout and behavior, rather than fictional values, are the acceptance criteria.

| Evidence | Result |
| --- | --- |
| [Desktop comparison](design/build-evidence/comparison-full.png) | Sections, hierarchy, input alignment and main actions match the approved direction. |
| [Filters and entry comparison](design/build-evidence/comparison-filters-entry.png) | Radar, Relative Strength and Builder are aligned; Strategy 1–3 remain individually available. |
| [Exit comparison](design/build-evidence/comparison-exit.png) | Exit chart and exit conditions have their own explicit section. |
| [Mobile comparison](design/build-evidence/comparison-mobile.png) | Sections stack; period controls use two columns; no horizontal page overflow. |
| [Market Trend window](design/build-evidence/market-filter-desktop.png) | Chart, benchmark pairs, method, action and conditional exit are grouped separately. |
| [Mobile range editor](design/build-evidence/mobile-range.png) | Editor fits the viewport; Cancel restores its original value. |
| [Mobile Market Trend](design/build-evidence/mobile-market-filter.png) | Content scrolls and dialog actions remain reachable. |
| [Independent chart contexts](design/build-evidence/mixed-charts.png) | Main Renko, exit P&F and Market Trend Candle can coexist without overwriting one another. |
| [Sample study results](design/build-evidence/sample-results.png) | Two planned trials yield two saved sample results, with working settings reuse. |

Approved source captures are `design/momentify-preview/screenshots/08-source-aligned-desktop.png`, `09-inline-filters-and-entry.png` and `10-source-aligned-mobile.png`.

## Findings resolved

1. **P2 — mobile alternatives editor clipped on the left.** An inherited centering transform conflicted with the mobile position. Removed that transform at the mobile breakpoint; confirmed the editor stays within the viewport and Cancel works.
2. **P2 — Market Trend benchmark market/symbol pairs separated visually.** Grouped each market and symbol together, with an explicit desktop grid and paired mobile rows. Recaptured the dialog after the fix.
3. **P2 — alternatives Cancel after leaving and resuming setup.** Kept the original editing snapshot in serializable draft state. Regression verifies that Cancel after resume restores the original baseline and alternatives.

No unresolved P0, P1 or P2 UI findings remained in the checked scope. The implementation is longer than the reference because it preserves the existing journey, source fields, portfolio evidence note and explicit test alternatives. This is intentional feature preservation.

## Interaction verification

- Turn Radar and Relative Strength on; edit their available controls.
- Open Market Trend, change Index/RS, method, action and chart; close with Escape and return focus to its launcher.
- Reopen cached Market Trend without requesting another configuration scan.
- Keep main, exit and Market Trend chart construction independent, including separate Renko ATR modes.
- Edit and cancel numeric alternatives and paired test dates.
- Plan two Period 1 values; review the actual trial values; generate two sample results; reuse Trial 2 settings.
- Select two universes and two Period 1 values and verify four planned tests.
- Browser error and warning log check: none reported after the checked interactions.

## Automated verification

| Check | Outcome |
| --- | --- |
| New research workbench suite | Pass: 27 main × exit × Market Trend layouts; every applicable descriptor has exactly one control destination. |
| Market Trend projection states | Pass: 864 chart, Index/RS, method and action states preserve their conditional fields. |
| Existing experiments UI suite | Pass: source choices/search/retry, alternatives, date planning, saved settings reuse and study controls. |
| Other relevant suites | Pass: setup, experiments, daily choice cache, date range, motion, storage/capture, dashboard, presentation, demo and both intelligence suites. |
| Runtime asset, syntax, manifest and permission check | Pass. |
| Public package allowlist / private-data check | Pass: 85 allowed files; preview fixtures and screenshots are outside the release allowlist. |
| Source and execution engine preservation | Eight core adapter/model/runner/storage files are unchanged, allowing for checkout line endings. |
| Installer tests | Not repeated for this UI-only change. |

## Limits and activation

The preview runs with clearly labeled fictional source choices and sample results. It does not contact RZone. These checks establish UI/model behavior; they do not establish live execution correctness for every chart.

The v0.18.0 runtime has now been copied to the existing installed directory after backing up the previous files. Saved studies and daily-cache storage were not changed. A real RZone Candle/Price report completed and the installed capture overlay confirmed saving 43 trades and 6 charts. This verifies the live calculation/capture path, not the new setup form or automatic multi-trial execution. The installed dashboard was opened; extension reload and new-layout acceptance are pending. Existing P&F/Renko execution gates remain closed.

## Preview

Run `node design/serve-connected-preview.cjs`, then open [Set up your test](http://127.0.0.1:8785/?demo=1&view=setup). The implementation remains vanilla JavaScript/HTML/CSS and reuses the existing setup model, cache, planner and study journey.
