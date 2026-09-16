# Three-minute demo

**New table controls:** in All runs, click the Return column heading twice. The display switches ascending then descending while Calmar ranks remain unchanged. Drag the Calmar heading before Return. Open Columns, enable Win ratio, hide a metric and drag the CAGR / annualized handle upward. Open Rank by to show the higher/lower-is-better guidance. Choose a matched group to show that the same columns follow you. Reset columns restores six defaults. On a phone, swipe the table sideways. Demo layout choices disappear on reload; real-library choices are local to the browser.

Start `npm run preview` and open the printed URL ending in `?demo=1`. The purple banner and record labels identify fictional data.

1. **Overview.** Open Momentum core. Show the four headline metrics, synthetic equity illustration, and original-style quick statistics.
2. **Settings.** Open Parameters. Point to Period 1–4, EMA 1–3, TMA Trend, Strategy 1–3, and their On/Off states. Execution and portfolio settings remain separate.
3. **Comparison.** Select Momentum core and Relative strength, then Compare selected. Show performance, drawdown, and changed settings. Filter for Renko to demonstrate that hidden selections stay counted.
4. **Variant and warning.** Clear selections and filters. Open Renko trend for ATR settings. Open Renko · review needed to show the deliberately conflicting price-mode example.
5. **Evidence.** Open Charts and Trades. Charts are static. Export an individual trade CSV or a full JSON backup; demo filenames start with demo-.
6. **Notes.** Rename a sample and save a research note, then Reset demo to return to the original fictional records.

For the visual-first demonstration, open **?demo=1&view=analysis** or choose **Analyze strategies**. Start with Momentum core's leader card, the compact ranking and return/drawdown plot. Switch Calmar, Return and Drawdown. Select the P&F group to show why one run cannot be named a winner. Return to the two-run Candle group and open **Filters & benchmark**: apply a 2% ceiling, then clear the field and apply to restore the ranking. Expand **Why these results?** only when explaining the settings. The buy-and-hold reference uses a separate fictional calendar-day index series, explicitly labelled as such. It is not actual Nifty performance. [Analysis details](INTELLIGENCE.md).

For a whole-library overview, choose **Compare within → All runs · exploratory**. Switch the ranking measure and choose **Show all 6 runs**: Candle, P&F, Renko and the different-period holdout appear together; the review-needed record stays unranked. Expand the conditions/settings or reported-statistics comparison only when needed. The per-run buy-and-hold table uses 2024 for the holdout and 2025 for the other eligible samples. Follow a **Group** shortcut to return to a matched comparison. The exploratory order is not a universal winner across different tests.

Demo returns come from a fixed synthetic monthly series. The displayed drawdown is calculated only at those observations. Trade rows are fictional illustrations of that series, not engine-generated transactions. None of these numbers demonstrate a strategy's effectiveness.

Click a chart dot to see the run's key metrics and main settings. In All runs, select **Holdout sample**: the index reference changes to 2024. Select **Renko trend**: it changes to 2025. Click the index square to inspect its measures, then **Hide details** to collapse the summary. Use **Inspect run** when dots overlap. This demonstrates period matching with fictional history, not actual Nifty performance.

For a public demonstration, keep the demo URL open. Switching to **Open my archive** can reveal that browser environment's own records.

## Experiment simulation

Open `?demo=1&view=experiments`. Choose New experiment, keep Momentum core as baseline, and enter `126,180,252` for Period 1. Save plan, then **Generate sample results**. The purple sample workspace shows illustrative rankings, baseline differences and immediate-neighbor checks. **Sample results ready** means those fictional examples were generated, not that Definedge executed a backtest. Stop sample generation and resume retain finished samples in memory. A later validation candidate is a separate stage. These series illustrate the interface and do not execute strategy logic or contact RZone. Reset demo clears them.
