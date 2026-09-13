# Changelog

## 0.6.0 — 2026-09-13

- Align chart/index metric labels and values in compact tiles; pair long settings on one edge and stack them on phones. Match library metric baselines and numeric table headings throughout the dashboard.
- Add ascending/descending strategy-table headers without changing financial ranks, leader explanations, chart selection or exports. Trade tables sort numbers, symbols and recorded dates; P/L amounts now show explicit positive and negative signs.
- Add a shared Columns control with 14 choices, show/hide checkboxes, accessible Left/Right movement, local persistence and reset. Rank and strategy stay visible; demo preferences remain in memory.
- Keep all chosen columns reachable through internal horizontal scrolling on phones and preserve that scroll position after sorting. Suppress repeated entrance animations during table updates; initial motion still respects reduced-motion preferences.
- Extend regression coverage for sorting, rank integrity, preferences, malformed saved choices, full exports and source immutability. Document the app-wide visual review and table controls.

## 0.5.1 — 2026-09-13

- Make return/drawdown points selectable by pointer, keyboard or a run selector, with a selection ring, inline key metrics/settings and links to the full report.
- Restore the index point in All runs for the selected run's own period; update its dates, coordinates and excess return when the selection changes.
- Add a visible index reference card and selectable index metrics, including ending capital for the selected run's initial investment. Explain unavailable coverage, sparse-history drawdown and fictional/real mismatches.
- Preserve original records, strict groups, all-run exclusions, ranking rules and local benchmark imports. Add regression coverage for selection/focus, period changes, text safety, unavailable history and unchanged archives.

## 0.5.0 — 2026-09-13

- Add **Compare within → All runs · exploratory** alongside the default matched groups, with Calmar/Return/Drawdown ordering, a return/drawdown map and shortcuts back to each matched group.
- Keep review-needed runs, repeated results, missing measures and ceiling failures visible but unranked. Fictional records mixed into real research are excluded from the real ordering.
- Add collapsed comparisons of all submitted settings and original statistics, and buy-and-hold calculations for each eligible run's own dates and capital.
- Export every run in the overview scope with rank/basis/status, settings, original statistics and per-run benchmark evidence. Preserve original archives, strict group calculations and CAGR-only Calmar.
- Extend the graphical README and demo walkthrough with the two comparison modes.

## 0.4.2 — 2026-09-13

- Prefer source CAGR in the overview, using Annualized Returns only when CAGR is unavailable, with the correct measure label.
- Apply the same preference to yearly-return sorting and side-by-side comparisons; CSV includes the selected measure and both original source columns.
- Keep zero and negative CAGR values, missing-value handling, original JSON records and CAGR-only Calmar calculation intact.

## 0.4.1 — 2026-09-13

- Handle missing extension storage and invalidated extension contexts with recovery instructions instead of a raw `local` property error.
- Retain a captured run after a failed storage write, offer a JSON recovery download, and retry the same run ID without recapturing another report.
- Handle disconnected Open vault actions and keep incomplete trade captures out of recovery exports.
- Added regressions for absent APIs, rejected writes, recovery import/duplicate handling, original settings and retry after report closure.

## 0.4.0 — 2026-09-13

- Simplified strategy analysis to a single comparable group, a clear leading-run takeaway, top-five leaderboard and real return/drawdown scatter plot.
- Added Calmar, Return and Drawdown ranking choices, preserving ties, missing data and ceiling exclusions without inventing a global score.
- Moved settings, explanations, benchmark controls and method details into disclosures; kept benchmark provenance and core limitations visible.
- Added responsive ranking columns, keyboard focus retention and reduced-motion-aware entrance/point animations.
- Added a direct analysis preview, regression coverage and fictional desktop/mobile screenshots.

## 0.3.0 — 2026-09-13

- Added strict comparison groups for matching recorded periods, universes, capital, allocation, limits and chart models.
- Added explained return/drawdown/Calmar leaders, risk ceilings, dominance, changed settings, duplicate evidence detection and capture exclusions.
- Added local Nifty price/TRI CSV references with date coverage checks, buy-and-hold figures and descriptive excess return.
- Included benchmark records in full JSON backups and restoration, preserving existing run IDs and source values.
- Extended the fictional demo and added method documentation plus calculation and integration tests.

## 0.2.0 — 2026-09-13

- Redesigned the research workspace with a dark navy and mint visual system.
- Added isolated fictional demo mode with Candle, P&F, Renko, and warning examples.
- Added a first-chart overview, compact settings groups, clear chart-type labels, and collapsed secondary statistics.
- Added keyboard-operable section tabs, visible focus states, a quick guide, filter reset, and comparison selection controls.
- Kept hidden selections visible in the selection count; selected CSV exports now match selected runs.
- Preserved the existing capture, archive, and number-formatting contracts.
- Added publication documentation, automated checks, and a public-source packager.

## 0.1.4

- Added P&F and Renko display adapters.
- Preserved and warned about conflicting execution price-mode controls.
- Completed six live variant saves; exported-data verification remains pending.

## 0.1.3

- Added consistent numeric display and verified-layout settings grouping.

## 0.1.2

- Fixed modal-blocked save controls and empty trade-table placeholders.
- Verified saved live Candle data against an exported archive.
