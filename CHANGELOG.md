# Changelog

## 0.18.0 preview - 2026-09-25

- Organize New test into Test setup, Portfolio, Strategy details, Entry conditions and Exit conditions.
- Place Radar, Relative Strength and its System Builder together; keep Strategy 1–3 visible and independent.
- Open Market Trend in a dedicated, responsive window while preserving chart, benchmark, method, action, exit and Test values controls.
- Keep entry, exit and Market Trend chart contexts independent. Existing execution eligibility remains unchanged.
- Use native checkboxes with separate On/Off trial alternatives; support cancelling edits, including after resuming a setup draft.
- Preserve source searches, paired dates, daily choice caching, saved studies and result reuse.
- Include the new stylesheet in Windows/Linux packages; check that every dashboard asset is in the release payload.

## 0.17.6 preview - 2026-09-18

- Search exit rules using the execution chart selected in Vault, even when RZone reopens the dialog using a different main chart. Restore the original source dialog after the search.
- Show search progress, match counts and errors beside the rule dropdown, including empty-query feedback. Keep stale replies from replacing current choices.
- Preserve the daily choice cache and existing chart execution gates. Download publication and installed-extension acceptance remain separate from source tests.

## 0.17.5 preview - 2026-09-18

- Search RZone from the symbol dropdown itself in Relative Strength and Market Trend Filter. Show all returned matches and keep selected symbols and Test values when another search is made.
- Share discovered symbols and exact search results for the local day across filter roles and RZone refreshes. Recheck all choices and the next local day invalidate those results.
- Keep exchange and native symbol identity attached to every choice. Ambiguous names remain unavailable rather than selecting a different instrument.
- Search matches are not a complete exchange catalogue. Broad source searches can be limited; enter a more specific name to find additional symbols.
- Download publication and installed-extension acceptance remain separate from source tests.


## 0.17.4 preview - 2026-09-18

- Compare cached dropdown objects by their contents, ignoring storage property order while preserving native option order, labels and identities. This fixes a reproduced false “RZone choices changed” rejection.
- Prevent an interrupted or failed full choice scan from restarting on chart changes, filter loading, polling or same-day draft resume. Recheck all choices explicitly retries; the next local day allows a new pass.
- Keep partial coverage visible and current edits intact. Successful daily metadata remains shared across source refreshes and tabs.
- Focused regressions reproduce both defects against the prior code. Installed/live acceptance is still required; download publication remains held.

## 0.17.3 preview - 2026-09-17

- Retain complete daily dropdown metadata across RZone refreshes and tabs: Group, private Radar choices, strategy categories, keyword results and loaded filter symbols. Recheck all choices refreshes it manually; a new local day expires it.
- Preserve fresh source inputs and exact submission checks; avoid repeated chart scans when Relative Strength is already on.
- Wait for symbol-menu dismissal to settle, including delayed replacement popups and native no-match results. Keep unknown dialogs untouched.
- Allow RZone's dialog-closing animation within the existing overall connection deadline and retry one ignored close click when no animation is running.
- These focused fixes still require installed/live acceptance; earlier 0.17.x downloads remain unpublished.

## 0.17.2 preview - 2026-09-17

- Wait through RZone's native symbol-loading spinner instead of rejecting it as an unexpected dialog. Reset result stability when a list is replaced so only settled symbols can be used.
- Preserve the bounded timeout, exact symbol identity checks and native query cleanup. Unrelated dialogs still stop discovery.
- Includes 0.17.0 and 0.17.1 improvements; their downloads were held after live filter discovery failures.

## 0.17.1 preview - 2026-09-17

- Close RZone symbol lists through their native clear-search behavior; preserve existing input text and stop safely on failed or ambiguous selections.
- Clear stale filter-loading state when leaving and returning to setup; preserve editable inputs and allow an explicit retry.
- Display terminal source-read errors in RZone instead of leaving a permanent Reading status; add symbol-search timeouts.
- Cover failed/late replies, navigation during discovery and retry recovery. Includes all 0.17.0 changes below; 0.17.0 download publication was held after the live loading-state report.

## 0.17.0 preview - 2026-09-17

- Put Radar's Off / On / Test both switch beside its source and rule.
- Add Universe and Timeframe Test values with every selected combination and separate matching-condition rankings.
- Add complete Relative Strength and Market Trend Filter editors, source-specific rule catalogues and confirmed benchmark searches. Optional settings load on demand; edits survive refreshes.
- Apply and capture the complete filter settings for each automated Candle/Price trial, including dynamic On/Off layouts, market-filter modes, methods and exits. Reject mismatched source settings and changed benchmark identities.
- Preserve source controls after discovery and searches, daily menu reuse, source-session guards, durable saves and original research archives.
- Keep P&F/Renko main/execution automation and non-Price execution gated; source inspection and fixture tests are separate from installed/live acceptance.

## 0.16.1 preview - 2026-09-17

- Correct the connection progress regression assertion for the updated status copy; release includes all 0.16.0 improvements below.

## 0.16.0 preview - 2026-09-17

- Add Use these settings beside saved trials and on reports. Reopen the full Step 1 form with exact recorded strategy, dates, exits and portfolio inputs; edit and run as a new study while preserving original evidence.
- Validate copied choices against current RZone menus, retain removed/unsearched choices for review and keep all execution gates. Preserve copied edits when reconnecting.
- Show every study's actual creation date/time, separate from its baseline name.
- Reuse daily shared Pre/Popular native menus across RZone refreshes and new tabs. Refresh Group/private choices and current settings, retain daily all-chart coverage and keep explicit Recheck all choices.
- Continue complete Windows/Linux ZIP distribution and same-folder updates.

## 0.15.0 preview - 2026-09-17

- Replace duplicate date-entry routes with one control showing each complete test range. Click a range to edit it; Test values adds another, and × removes an unwanted range.
- Treat new date variations as paired periods, with strict validation, deduplication and accurate combination counts. Preserve the meaning of previously saved independent-date studies.
- Keep the first visible numeric alternative when returning to a single value, and preserve equivalent values when switching list/range editors.
- Use the same date-range entry for validation and holdout; retain unseen-period boundaries, source readback, comparison groups and sample isolation.
- Guard cancelled/disposed calendar callbacks and preserve range drafts through supported same-tab navigation and source choice refreshes.
- Include the complete Windows/Linux installable package and updated graphical instructions.

## 0.14.0 preview - 2026-09-17

- Keep each study in one visible journey: Set up → Run tests → Review results, with a current-stage indicator and a relevant next action. The indicator only shows progress; it cannot submit or restart a test.
- Open the installed workspace on My studies. Rename Analyze strategies to Compare results, and the saved-run action to Test variations; new tests automatically belong to a study.
- Keep the source form, inline Test values, dates and portfolio on one setup page, with secondary strategy controls under More strategy settings. Review … tests opens the final review; Run … tests starts execution.
- Retain an unfinished setup while navigating within the same open Vault tab, with Continue setup in My studies. Refreshing or closing the tab clears the unsaved draft.
- Show completed work at Review results; View results focuses saved evidence without running anything. Rename study export and make the separate Test on another period validation action clearer.
- Preserve saved-run evidence, comparison groups, sample isolation, deletion protections, execution limits and the complete Windows/Linux installable package.

## 0.13.0 preview - 2026-09-17

- Add a functional date-range calendar with typed dates, month/year navigation, 1/3/5-year presets and Apply/Cancel. Separate From/To test values and all-combination checks remain.
- Add circular progress driven only by saved trials; skipped and interrupted trials never count as saved.
- Show the latest saved reports with one-time arrival motion and direct report links.
- Add brief panel transitions and subtle study-card hover/focus feedback. Respect reduced-motion preferences; financial figures remain steady.
- Include the controls in the complete Windows/Linux package, without additional runtimes or services.

## 0.12.0 preview - 2026-09-17

- Add Delete study from the experiment list and study detail, with a named confirmation and Cancel focused by default.
- Retain saved runs when deleting a study. Recheck current execution state and serialize deletion with the runner to protect active work.
- Remove demo shortcuts from the everyday header and empty state. Keep the explicit fictional preview route isolated for development and documentation.
- Preserve the complete Windows/Linux install and update package; execution adapters and chart acceptance scope are unchanged.

## 0.11.0 preview - 2026-09-17

- Complete Windows/Linux ZIP with dependency-free setup/update helpers and an offline start guide.
- Stable per-user installation folder and existing-folder updates that preserve extension identity without accessing browser storage.
- Payload checksums, staged installation, replacement verification, and failure recovery.
- Reproducible release packaging, extracted-package checks on both platforms, and tagged publication gated on application and installation checks.
- Application logic and live-execution scope unchanged from 0.10.0.

## 0.10.0 preview - 2026-09-16

- Make Candle, P&F and Renko selectable in the setup editor, with independent main/execution charts, their own rule menus, box/brick controls, strategy inputs and retained drafts. P&F/Renko automatic execution remains gated pending separate live write acceptance.
- Check native choices for all three charts during the first connection of the local day, with exact source restoration between checks. Reuse menus within the same RZone document session; read current settings fresh on every connection.
- Add Recheck all choices for an explicit full refresh. Invalidate stale menus on day/session/adapter changes, retain the usable form after a failed additional-chart scan, and reject outdated source replies.
- Preserve exact archived settings and ambiguous source price selections. Add focused chart, cache, restoration and legacy-compatibility regressions.

## 0.9.0 preview - 2026-09-16

- Stack Momentum Trading BackTest above Portfolio Backtesting in the setup form.
- Extend inline Test values to start/end dates, rank criteria, allocation, initial capital, maximum open trades and daily stock limits. Date choices use calendar inputs; every generated period must end after it starts.
- Keep different dates and portfolio assumptions in separate comparison groups, and preserve each trial's actual settings through submission, saving and export.
- Validate later research periods against the latest date actually tested. Existing chart, selection and required portfolio-report restrictions remain explicit.

## 0.8.9 preview - 2026-09-16

- Extend native-menu discovery and My/Public keyword search to Candle/Price Exit Strategy, with the same source restoration and exact-selection checks as STR1–3.
- Preserve the observed label dependency between STR2 and STR3 when their categories change, including simultaneous changes. Keep final submitted-settings comparison exact.
- Make the current NSE setup limit explicit: other markets remove Radar and require a separate form adapter. Existing archives remain readable.
- Wait for rule controls to become enabled before searching, and reserve source-restoration time inside the existing connection deadline.
- Consolidate a live inspection of Candle, P&F, Renko, market/group choices, STR1–3, Radar, Relative Strength, Market Trend Filter, execution and portfolio controls. This inspection does not enable unvalidated chart automation.
- Add cross-stage search, restoration, ambiguous/missing result, combined strategy/exit and capability regressions. Installed acceptance remains separate from these checks.

## 0.8.8 preview - 2026-09-16

- Fix connection discovery for STR My/Public: RZone replaces native dropdowns with searchable fields, so an empty search is no longer mistaken for a stuck dropdown.
- Search My/Public from Vault with a name or keyword. Keep search-required, no matches and loaded choices distinct; identical names remain unavailable for automatic selection.
- Preserve each category's actual source control type in setup validation and saved plans. Resolve an exact unique search result before execution; preserve source settings during choice reads.
- Add search-control transition, empty-result, restoration, request-session and stale-response regression coverage. Installed acceptance remains separate from automated checks.

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
