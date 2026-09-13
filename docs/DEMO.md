# Three-minute demo

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

For a public demonstration, keep the demo URL open. Switching to **Open my archive** can reveal that browser environment's own records.
