# Strategy intelligence

Choose **Analyze strategies** to analyze the full library, or **Explain comparison** from a selected comparison. This is a transparent shortlist of reported historical results. It does not predict which strategy will win next.

## Read the visual ranking

The first view opens the group with the most comparable runs. Choose another group using **Compare within**. Groups remain separate; no global winner is calculated.

1. Read the leading-run takeaway and its reason. Switch **Calmar**, **Return** or **Drawdown** to rank by that single measure. Higher Calmar/return or lower drawdown leads.
2. Scan the first five table rows and the return/drawdown plot. Higher and further left means more reported return with less reported drawdown. Mint marks leaders, amber marks runs above the ceiling, and an index reference uses a square. Names, ranks, status text and exact table values supplement colour. **Show all** reveals longer groups; on phones the table shows the selected measure, with full metrics available through the run.
3. Open **Filters & benchmark** to set a drawdown ceiling or import an index. Open **Why these results?** for aligned controls, changed settings and full benchmark measures. **Method & excluded runs** explains exclusions and repeated evidence.

Equal values share competition ranks (1, 1, 3). Ceiling failures and missing values remain unranked. A single eligible measured run gets no rank; an incomplete group gets no leader takeaway. Where two or more values are available but another is missing, numeric ranks describe only the available values. Negative leaders retain their signs and an explicit non-positive-return explanation.

**Export analysis CSV** includes all analyzed groups, regardless of which is visible. The return/drawdown plot contains actual reported aggregate measures and, when available, index closing-observation measures; it is not an equity curve. Animations are brief, values never count up, and reduced-motion preferences disable the added entrance effects.

## Comparable groups

A group requires the same recorded universe, market, timeframe, submitted start/end dates, initial capital, fixed/reinvestment allocation, maximum open positions, enabled daily stock limit, momentum chart type, execution chart type, execution price mode, and real/fictional status. An unchecked daily limit is treated as Off regardless of its inactive input.

Strategy parameters can vary inside a group. **Changed strategy settings** lists those differences by semantic field, including periods, EMA/TMA, Relative Strength, entry/exit rules and chart settings. Unfamiliar form layouts, capture warnings, ambiguous price modes, missing controls, report/submission mismatches, incomplete trade counts and invalid headline metrics exclude a run from ranking. Excluded records stay in the library.

Repeated results with identical controls, strategy settings, headline statistics and trades count once, even if renamed or saved again. The engine never changes the original runs.

Costs, dividends, cash flows, leverage, historical universe membership, underlying named-rule definitions and equity valuation frequency are not confirmed by the captured form. Matching recorded controls does not prove these unobserved assumptions match. In particular, a Candle execution model is marked unverified because that form supplies no independent price-mode control.

## What the leaders mean

- **Highest gross return:** largest source Gross Total Returns within the group and your optional drawdown ceiling.
- **Lowest drawdown:** smallest positive-magnitude source Max Drawdown.
- **Derived Calmar:** source CAGR divided by maximum drawdown for the same reported run. For example, 12% CAGR / 8% MDD = 1.50. The ratio is not a percentage.
- **Return / drawdown frontier:** no eligible peer has at least as much return and no more drawdown with one strictly better. Other runs identify the peer that dominates them.

A unique Calmar leader is named only when at least two eligible peers have valid Calmar values. Ties stay ties. Missing CAGR is not replaced with Annualized Returns or the source's differently labelled Calmer Ratio. Zero drawdown gives an undefined Calmar, not infinity. Negative returns remain negative even when their ratio leads.

A period under a year and fewer than 30 reported trades receive evidence flags. These are simple review prompts, not statistical confidence estimates. Review zero-quantity rows, repeated parameter trials and an independent holdout period before drawing a conclusion.

There is no arbitrary weighted score. Returns, CAGR, drawdown and Calmar are interpreted together; they are never summed across strategies. A combined portfolio needs synchronized portfolio equity series, valuation/cash-flow conventions and explicit weights. Static chart screenshots cannot establish that result.

## Nifty buy and hold

Open **Filters & benchmark → Add Nifty benchmark data**, choose the index name and price/total-return basis, then import one index's CSV from the [official NSE Indices historical-data page](https://www.niftyindices.com/reports/historical-data).

On the NSE page, choose **Total returns Index Values** for TRI, then Equity → Broad Market Indices → NIFTY 50. Select the dates covering your runs and download the CSV. For price-only history, use Historical Index Data. The source website controls data availability and export behavior.

TRI includes dividends reinvested; a price index excludes dividends. This distinction follows [NSE's index explanation](https://www.niftyindices.com/resources/index-concepts/total-return-index). It is still necessary to verify the strategy's own dividend/cost basis.

Accepted columns:

| Basis | Date column | Value column |
| --- | --- | --- |
| Total return | Date | Total Returns Index, Total Return Index, TRI, or Value |
| Price | Date | Close, Closing Value, or Value |

Use ISO dates (YYYY-MM-DD) or DD-Mon-YYYY. Two-digit years and the source's DD-Mon YY form are accepted. Quoted thousands separators and UTF-8 BOMs are supported. Duplicate dates, mixed index names, invalid dates, non-positive/non-finite levels, and mismatched index names are rejected. CSV import is limited to 20 MB and 50,000 observations. Review the selected basis and source; parsing cannot authenticate a file's origin or completeness.

The app shows the imported source filename, basis, actual observation dates and count:

- Return = ending level / starting level − 1.
- Annualized growth = (ending / starting)^(365.25 / elapsed calendar days) − 1.
- Drawdown = the largest fall from a previous peak in the imported closing observations.
- Ending capital = the strategy's reported initial capital × ending / starting index level.
- Gross excess return = strategy gross return minus benchmark return, in percentage points. This is descriptive, not risk-adjusted alpha.

The first and last observations inside the requested period are used. Missing edges exceeding four calendar days withhold the comparison. A smaller edge shift is disclosed as an approximate period comparison; no holiday calendar is silently assumed. Sparse observations (less than 0.45 per elapsed calendar day, fewer than three, or any gap over seven days) withhold benchmark drawdown and Calmar. The return remains descriptive. No interpolation is performed. Imported-close drawdown can differ from a strategy's intraday or differently sampled drawdown.

Actual Nifty history is not bundled, automatically fetched, or redistributed. Demo mode contains only an explicitly fictional calendar-day index illustration. Fictional benchmark data cannot be compared to real runs, or vice versa.

## Storage and exports

Index references are stored locally, separately from run records. **Back up all** includes optional benchmark records in the JSON envelope; **Export run** exports only that run. Existing JSON archives without benchmark data remain valid. Import validates all files before writes and skips existing run/benchmark IDs. Storage write failures can still leave a partial import; the notice reports failure, and re-import safely skips completed IDs.

**Export analysis CSV** includes aligned controls, headline measures, dominance, reference basis/source/effective dates, excess return and caveats. Numeric export precision is capped at six decimals; calculations use original numeric precision and original JSON values stay intact. A CSV is a review snapshot, not a complete backup.

## Validation and limits

Automated checks cover cohort controls, evidence exclusion, duplicate detection, missing/invalid CAGR, zero drawdown, ties, negative leaders, return/drawdown math, CSV parsing, missing edges, sparse series, fictional/real separation, text rendering, immediate backup after CSV import, JSON roundtrip and duplicate/malformed imports.

The feature was exercised in the standalone Chrome demo: analysis groups, leader/exclusion text, source labels and the drawdown ceiling passed. The new narrow-screen check was interrupted by browser-control timeouts and remains unverified. The installed extension dashboard and actual Chrome file-picker import remain unverified because browser automation cannot access those surfaces in this environment. Official Nifty history availability is not guaranteed by the tests. The local source tests use synthetic series.

## Method references

- [Calmar calculation in the primary empyrical implementation](https://github.com/quantopian/empyrical/blob/master/empyrical/stats.py): annual return divided by the magnitude of maximum drawdown.
- [NSE Total Return Index](https://www.niftyindices.com/resources/index-concepts/total-return-index): dividend treatment.
- [Bailey and López de Prado, The Deflated Sharpe Ratio](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551): selection bias and backtest overfitting. Vault does not calculate a deflated Sharpe ratio or statistical significance from summary metrics.
