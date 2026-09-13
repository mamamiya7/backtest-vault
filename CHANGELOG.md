# Changelog

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
