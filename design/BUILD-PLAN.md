# Connected setup redesign — completed 25 September 2026

Implement the approved source-aligned Momentify preview in the existing Vault application, on `codex/vault-ui-redesign`. The installed application remains unchanged.

Status: implemented and verified locally. Open [Set up your test](http://127.0.0.1:8785/?demo=1&view=setup); start the preview with `node design/serve-connected-preview.cjs`. The preview uses fictional source choices. The installed build has not been replaced.

## One-page arrangement

1. **Test setup:** study name, exchange, source-backed universe, one paired date control.
2. **Portfolio:** capital, open trades, rank, allocation and daily limits.
3. **Strategy details:** four numbered periods and weights, three EMAs, retracement, volume, TMA and trend quality. Independent entry chart construction. One row for Radar Fundamentals, Relative Strength benchmark, and Relative Strength System Builder. Market Trend Filter opens its own window from this section.
4. **Entry conditions:** Strategy 1–3, each with its native enable state, source/rule and timeframe or chart-specific input. No global Multi Timeframe gate.
5. **Exit conditions:** explicitly named exit chart, construction, selection type, exit rule, stop and target.
6. **Review:** the existing planner and study journey; one persistent review action. Existing studies, saved-run reuse, archive, comparisons and results remain available.

## Implementation boundaries

- Reuse `fieldsForUI`, `sourceField`, alternatives, date-range, searches and planner. No copied mock catalogue in production.
- Checkbox enables a filter; an adjacent Test on & off action expresses separate trials. Values and ranges use the same field, with an explicit cancel operation.
- Render every model field once, including conditional fields. Market Trend has independent chart, Index/RS, method, action and conditional exit controls.
- Do not change source adapters, caches, native identities, archives or execution capability gates. P&F/Renko editing is not proof of real automatic execution.
- Exclude live orders, rebalance and market protection.
- Use the current vanilla JavaScript/CSS stack. A React/shadcn rewrite would expand the change without improving this layout.

## Verification

- Cross-chart field inventory, checkbox/test-both, alternatives, Universe × Timeframe, paired dates, Market Trend window, independent exit context, saved-run reuse and review/back retention.
- Existing setup, planner, cache, UI, archive and comparison suites. Record prior runner audit failures separately; do not mislabel them as fixed by a UI change.
- Browser checks at desktop and mobile sizes; inspect errors, keyboard/Escape and primary workflow. Compare rendered UI with the approved screenshots, not only source code.
- No installer test cycle for this presentation-only branch. No replacement of the installed extension during this build.

## Architecture evidence

The existing Graphify map points from the independent-chart and filter concepts to `source-layouts.js`, `setup.js`, `experiments.js`, `experiments-ui.js` and the coordinator/runner. The completed combination audit is the dependency contract. Graphify's executable was blocked by Windows policy in the audit; use its existing graph and query evidence rather than bypassing that restriction.

## Completed checks

- 27 main × exit × Market Trend chart layouts: each model field has exactly one destination.
- 864 Market Trend Index/RS × method × action states; source-owned conditional fields remain intact.
- Existing setup, experiment, UI, daily-cache, dates, motion, capture/storage, dashboard, presentation, demo and intelligence suites pass.
- Browser: range edit/cancel, Radar/RS activation, paired dates, independent Candle/P&F/Renko contexts, separate Renko ATR modes, Market Trend open/Escape/focus, review, two sample results and saved-trial reuse.
- Desktop and 375-pixel mobile visual comparison; corrected an inherited mobile editor transform and kept benchmark market/symbol pairs together.
- Local asset/syntax/permissions check and public allowlist check pass. No installer cycle was needed.

## Activation boundary

This is a working UI build on the redesign branch, not a claim that every chart can execute live. Existing P&F/Renko execution gates and the audit's unresolved runner cases are unchanged. Before replacing the installed app, activate this branch deliberately and do a small real RZone acceptance run. No source scans or live runs were submitted during the UI build.
