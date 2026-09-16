# Known limitations

- Preview release; not listed in the Chrome Web Store.
- Experiments includes a Candle DOM runner, finite/sample/adaptive planner and durable journal. New test in v0.8.4 preview configures a complete Candle/Price setup in Vault and refreshes available rule menus from RZone. Live acceptance of this new flow remains pending. The v0.7.3 three-trial period sweep covered one fixed saved baseline. P&F/Renko execution, dynamic RS and Market Trend Filter remain gated. See [Experiments](EXPERIMENTS.md).
- The extension depends on Definedge's visible form and report structure. Future changes may require new adapters.
- Five exported Candle runs have been checked against live references. Three P&F and three Renko saves completed live, but their exported archive verification is pending.
- The dashboard and v0.4.0 strategy analysis were exercised in a standalone Chrome preview. Automation could not inspect the installed extension dashboard or complete its file-picker import flow.
- Renko execution can retain two checked price-mode controls in the source. The app warns and preserves both values.
- Rule names do not imply capture of their hidden numeric definitions.
- Charts are static SVG snapshots. Hover data and underlying price series are absent.
- Formatting improves presentation only. It never silently changes source signs, missing metrics, or original JSON values.
- Large libraries and unusually large reports can exhaust browser memory or storage. Individual import files are limited to 100 MB.
- Browser-local storage is not synchronized and is not a backup.
- Strategy rankings are provisional reported-result comparisons. Costs, dividends, leverage, cash flows, historical universe membership and valuation frequency are unverified. Missing CAGR is not substituted; zero drawdown does not produce infinite Calmar.
- Nifty history requires local CSV import. No actual index data is bundled. Missing edges and sparse series constrain benchmark comparisons; see [the method](INTELLIGENCE.md).
- No combined-portfolio return/drawdown, risk-adjusted alpha, significance test or future-performance prediction is calculated from summary metrics.
- Responsive and keyboard checks do not establish full WCAG compliance. Screen-reader, real-device touch, 200% text enlargement, and print-device testing still need broader validation.
