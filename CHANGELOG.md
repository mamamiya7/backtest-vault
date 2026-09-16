# Changelog

## 0.8.7 preview - 2026-09-16

- Load every offered Radar category alongside Strategy 1–3. Restore the original source controls and keep each category's rule and Test values separate in Vault; empty account lists stay empty.
- Put dates, rank criteria, execution chart/selection, exit strategy, target, stop loss and portfolio sizing on the main setup page. Backtest opens a compact final review with comparison rules and an explicit Run action.
- Preserve supported chart gates, exact source read-back, legacy setup compatibility and local sample isolation. Installed acceptance remains separate from automated tests and preview checks.

## 0.8.6 preview - 2026-09-16

- Wait for RZone's initial controls to settle before recording the setup used for Group discovery. Keep strict change detection and identify affected controls when a source changes during a read.
- Close only the discovered Group menu by clicking the verified plain Chart Type label. The previous heading target could open RZone's help popup; the new target was checked on the live form with 264 groups and no changed settings.
- Add delayed-initialization and real-setting-drift regressions. Strategy category caching and execution remain unchanged; installed connection acceptance is pending activation.

## 0.8.5 preview - 2026-09-16

- Load every offered Pre, My, Public and Popular rule category for Strategy 1–3 during New test and Refresh choices. Temporarily enable each source row, then restore its exact category, rule, timeframe and checkbox state without submitting a backtest.
- Switch loaded strategy categories immediately in Vault. Keep separate rule selections and Test values for each category; never mix rules between strategies or categories. Empty lists stay empty, and removed choices remain visible for review.
- Validate plans and imports against the chosen category, retain legacy setup compatibility, and keep source categories fixed within a batch. Discovery has a bounded read and restoration budget; existing source dialogs remain untouched.
- Add model, UI and runner regressions covering all three rows and four categories, delayed/empty/rejected menus, exact restoration, draft retention and category-specific trial validation. Installed acceptance of the new strategy catalogue scan remains pending activation.

## 0.8.4 preview - 2026-09-16

- Load current source dropdowns automatically on New test when exactly one RZone tab is available. Multiple tabs still require a choice; failed reads allow explicit retry without a polling loop.
- Read RZone's full exposed Group list into a searchable Vault dropdown with mouse and keyboard selection. Preserve the original source query/settings and close only the menu opened for discovery; no backtest is submitted.
- Refresh groups when Market changes and retain edited values across refreshes. Removed or unavailable choices require review; blank selections never silently choose the first group.
- Keep source-session boundaries, legacy setup archives, demo isolation and current Candle/Price automation limits. Dependent rules load for the selected source context, not an exhaustive traversal of all chart/rule combinations.
- Add regressions for delayed group lists, duplicate/oversized/missing catalogues, source restoration, automatic connection, local search, keyboard selection and unavailable choices. Installed acceptance of the new catalogue reader remains pending activation.

## 0.8.3 preview - 2026-09-16

- Bring the selected RZone tab forward while connecting or refreshing choices so its dialog animations can finish. Return to the initiating Vault tab only if the user has stayed in RZone and that Vault tab still exists.
- Recheck the owned dialog after a delayed timer wakes. An already closed dialog now succeeds even if the timer woke past its deadline; an open dialog still fails without starting a backtest.
- Preserve source selection, existing reports, connection deadlines, draft entries and all execution guards. No additional browser permissions are requested. Installed acceptance of this connection update remains pending.

## 0.8.2 preview - 2026-09-16

- Replace editable setup checkboxes and separate On/Off variation popups with one **Off / On / Test both** selector. Test both creates separate enabled and disabled trials; choosing a fixed state removes that variation.
- Label Period 1–4 and EMA 1–3 directly, align their values and weights, and use the same state controls for filters and exits. Keep values editable when a batch includes the enabled state.
- Preserve reviewed values and Test both choices across source refreshes. Clearing a removed rule also clears its gate and rule variations. Fixed or unsupported settings retain their existing execution limits.
- Verify desktop and phone layouts, exact trial combinations, the six-setting limit, draft preservation and no execution before Run. The source runner is unchanged.

## 0.8.1 preview - 2026-09-16

- Bound the entire Connect RZone request, including waiting for the background queue. An unanswered request now shows an error beside the connection control and allows an explicit retry; a late response cannot overwrite a newer attempt or draft.
- Keep failed choice refreshes visible beside the form and preserve entered settings. Recover cleanly if a returned catalogue cannot be rendered.
- Show connection stages in RZone's Vault bar, with completion only after the settings dialog has closed and a visible message when reading fails.
- Test the actual background, coordinator and content-runner message path through configuration and three sequential synthetic trials. Add stalled-response, late-reply, retry and render-failure regressions. The installed connection failure has not yet been reproduced; real acceptance remains pending.

## 0.8.0 preview - 2026-09-16

- Add **New test**: connect a signed-in RZone tab and configure a single form arranged like RZone. Inline Test values controls add numeric lists/ranges, On/Off alternatives and eligible menu choices. Backtest opens dates, exits, portfolio and final run review. A saved baseline is no longer required; **Use a saved run** preserves the previous workflow.
- Read dropdown choices from the current source session. **Refresh choices** and available rule-source changes refresh dependent menus without submitting a backtest. Keep removed choices visible for review rather than silently substituting another rule.
- Use familiar period checkboxes, values and weights, EMA/TMA, retracement, volume, available Radar/strategy/exit rules, dates and portfolio controls. Confirm the exact group through RZone autocomplete before execution.
- Store new setups as settings-only plans, with no fabricated baseline performance or submission history. Apply the full reviewed setup and verify source values before running; preserve complete capture, durable save acknowledgement and fresh submission evidence.
- Support single-run plans and retain bounded variation queues. Keep fictional sample setup/results separate from RZone execution and local research storage.
- Limit the new automatic setup adapter to Candle/Price with Relative Strength and Market Trend Filter off. P&F/Renko execution stays gated. Live acceptance of the new full-setup and dropdown-refresh flow remains pending; v0.7.3's verified three-trial batch covered the older saved-baseline route.

## 0.7.3 - 2026-09-16

- Require an observed fresh running-to-completed strategy lifecycle. A preceding Completed label cannot finish a new trial while the source is still calculating.
- Bind each automatic capture to its exact strategy and portfolio submissions, source document session and observed timestamps. Existing or reopened report nodes cannot become a new trial's evidence. Preserve manual capture and recovery.
- Verify the stored run's identity, phase, real-data status, settings and execution receipt before advancing. Stop on expired or missing ownership; late messages cannot revive an expired trial. Review existing run IDs instead of overwriting them.
- Keep discovery dates and validation stage order fixed. Older experiment results without execution evidence remain available, with their ranking withheld.
- Separate the sample workspace visually, rename its action to Generate sample results, and label finished examples Sample results ready. Imported sample plans cannot offer real execution controls. Add collapsed Execution evidence for real trials.
- Expand regressions for stale completion, missing running state, source rejection, reused/hidden reports, interrupted saves, storage reordering and queue recovery.
- Complete a real three-trial Candle batch in the installed extension. Verify exported settings, source metrics, full trade counts, six charts per run, distinct submission receipts and save acknowledgement before each next trial. P&F/Renko execution remains gated.

## 0.7.2 - 2026-09-13

- Validate saved experiments by their values, ignoring object-property order returned by storage. Unchanged plans no longer fail with "Experiment settings were altered" solely because their properties were reordered.
- Preserve ordered arrays, setting indices, approved values, trial order and frozen validation candidates. Actual edits remain rejected.
- Make repeated-report detection independent of object-property order. Exercise coordinator recovery and all three sequential DOM trials with reordered storage responses.

## 0.7.1 - 2026-09-13

- Check registered RZone tabs directly for discovery and immediately before Start. A delayed background timer no longer removes a responding source after 15 seconds.
- Auto-select a single ready Candle tab, preserve an existing selection when disconnected, and disable Start with a current connection message when needed.
- Keep native dropdown options unchanged while focused so refreshes cannot dismiss the menu. Never silently switch a chosen source to a different tab.
- Wake the selected runner after Start without waiting for its next page timer. Status probes cannot submit trials, renew leases, or replace the recorded document owner.
- Add regression coverage for delayed heartbeats, closed/reloaded tabs, open dialogs, untrusted status requests and dropdown interaction during refresh. Live installed batch acceptance remains pending.

## 0.7.0 - 2026-09-13

- Add Experiments: saved baselines, validated ranges, grid/sample/bounded adaptive modes, frozen decision rules and a finite queue preview.
- Add a persistent single-tab coordinator and Candle DOM executor, with read-back checks, both submission snapshots, full-report saving, uncertain-state recovery and stop-after-current. Live acceptance remains pending; P&F/Renko plans retain execution gates.
- Add Decision Desk rankings, baseline deltas, immediate-neighbor checks, local index context, and separate frozen validation/holdout stages.
- Add memory-only fictional simulation and version-2 backups including experiments; old run archives remain compatible.
- Add three suites for planner/coordinator/decision integrity, UI/backup isolation and three sequential Candle DOM trials.

## 0.6.1 — 2026-09-13

- Replace the full-width column panel and repeated table instructions with a compact Columns menu. Remove visible field counts and duplicate ranking-direction text.
- Move higher/lower-is-better guidance into the Rank by menu.
- Drag optional table headings horizontally, or use the column menu's vertical drag handles. Checkboxes, reset, keyboard ordering and shared local preferences remain available.
- Show a lifted drag preview and insertion marker; support cancellation, edge scrolling, focus retention and phone-sized menus. Dragging leaves financial ranks and source records intact.

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
