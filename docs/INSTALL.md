# Installation and troubleshooting

## Chrome extension

Load the unpacked **dist** directory, which contains manifest.json. Selecting the project root causes Chrome's “Manifest file is missing or unreadable” error.

Use the same folder for future reloads. Back up first, then reload the extension and refresh both Definedge and Vault to load changed scripts. Removing the extension is not required for an update.

Sign in to RZone as usual, then open Vault using the extension toolbar. **You do not need to complete or save a backtest first.**

1. Choose **New test** in Vault.
2. With one available RZone tab, Vault loads its choices automatically. With several tabs, select one and click **Connect RZone**. RZone comes forward briefly while Vault reads its controls, then you return to Vault. If you switch tabs yourself, Vault leaves your chosen tab active. Connecting does not submit a backtest. If Vault cannot find Momentum Trading BackTesting, open RZone's Research menu as prompted, then reconnect.
3. Set up the strategy in the RZone-style form. Search and select **Group**. For **Strategy 1, 2 or 3**, choose **On** beside the row, then select **Pre / My / Public / Popular** and its rule. Vault loads all offered categories automatically, even if the source rows started off. Choose **Off** to skip a period/filter or **Test both** to compare separate On and Off runs. Add **Test values** beside a number or menu to compare values or a range. Use **Refresh choices** after adding or changing rules in RZone.
4. Click **Backtest**, review dates, exits, portfolio settings and the test count, then click **Run … tests**. Leaving all variation controls unused runs the current setup once.
5. Leave RZone open and avoid editing its settings while the queue runs. Vault saves each completed report automatically. Use **Export experiment** for a backup of that test, or **Back up all** on the main library page.

This preview's new-test adapter uses Candle and Price selection, with Relative Strength and Market Trend Filter off. P&F/Renko automatic execution remains gated. The new full-setup workflow needs its own live acceptance; the earlier saved-baseline three-trial Candle test does not establish that acceptance.

To continue an existing saved baseline, use **Experiments → Use a saved run**. That workflow requires the RZone tab's fixed settings to match the saved baseline. You can also work manually in RZone: submit the momentum and portfolio tests, wait for the report and all trade rows, then click **Save backtest**.

## Standalone viewer

Run `npm run preview`. The demo URL uses fictional records. Remove `?demo=1` to open this browser origin's separate archive and import a JSON backup. Serving the files over localhost is the supported viewer workflow.

The standalone viewer cannot directly read Chrome extension storage or connect to RZone. Export from the extension and import the JSON file in the viewer. Use the installed Vault for a new connected test; the demo uses fictional choices and results only.

## Common problems

| Symptom | What to check |
| --- | --- |
| Manifest missing | Load dist, not its parent folder. |
| Save controls missing after an update | Reload the extension, then refresh Definedge. |
| Save says it cannot read `local`, or Vault is disconnected | The extension storage API is unavailable in that tab. Reload the same extension and then refresh Definedge. In v0.4.1 or later, download any recovery backup before refreshing. Submit both backtests again if settings were not retained. |
| Save reports incomplete trade pages | Keep the report open and wait for loading to finish. Retry after the site is stable. Partial captures intentionally fail. |
| Settings were not linked | Submit both strategy and portfolio backtests after capture has loaded. Do not reinterpret the currently visible form as evidence for an older report. |
| Blank library in the viewer | It has separate storage. Import an exported JSON backup. |
| Import is disabled | You are in demo mode. Open my archive to import. |
| No source tab is available | Open RZone, sign in and return to the installed Vault. Refresh RZone after an extension update. Close existing dialogs only after preserving any unsaved report. |
| Connect stays on Reading available settings | Version 0.8.1 bounds the request to 70 seconds while the page is active and displays a retry error beside Connect. RZone's Vault bar shows the reading stage or source error. After updating, reload the same extension and refresh both pages; preserve any pending report first. Retry only when the source is ready. Connecting never submits a backtest. |
| Source dialog did not close | Version 0.8.3 brings RZone forward during connection and checks the actual dialog state after delayed timer callbacks. If the error remains, open RZone and let its settings dialog finish closing; close it manually if needed, then retry Connect in Vault. Preserve any existing report before closing it. |
| A dropdown is missing a recently added rule | Use **Refresh choices**, then choose the intended category. Strategy 1–3 load all offered Pre/My/Public/Popular lists. Empty account categories stay empty; unavailable old selections need review. |
| Group could not be confirmed | Refresh choices and select a Group from the searchable dropdown. Execution still requires the same exact choice to exist in RZone. |
| Group list did not load | Let RZone finish loading its Group search, close that menu, then retry Connect or Refresh choices. Vault preserves your entries and does not run a test after a failed read. |
| Refreshing choices seems to open RZone settings | This reads the available controls and may change a rule source. It does not submit a backtest. **Run** starts the calculations. |
| An experiment finishes almost instantly | Check the workspace label. **Generate … sample results** creates fictional examples without contacting RZone. Real execution uses **Run … tests**, or **Start experiment** for a saved plan, inside the installed extension. Inspect **Execution evidence** for source submission and capture times. |
| A duplicate import adds zero runs | Existing IDs stay unchanged. This prevents accidental overwrites. |
| CAGR / annualized return is missing | Neither source value was available. The summary prefers CAGR and otherwise shows Annualized return, with the matching label. |
| Both Renko price modes are selected | This is an ambiguous source form state. Review the record; Vault preserves both settings. |

If reporting a problem, include the version, chart type, steps, and a fictional reproduction. Do not attach a private archive to a public issue.

## Recovering a failed storage write

Version 0.4.1 checks whether extension storage exists and handles rejected writes. If a report passes capture checks but cannot be written, it shows **Not saved to Vault**, keeps that run in this tab, and offers **Download recovery backup**. Confirm the JSON file finished downloading before refreshing or closing the tab. After reloading the extension, open Vault and use **Import runs** to restore it. The recovery file contains only that captured run, including its original settings linkage and warnings; it is not a backup of the whole library or benchmark collection.

**Retry captured run** attempts to write the same captured values and ID. It does not read a different report that happens to be open later. No partial trade capture gets a recovery file. A successful storage write clears the pending recovery controls; downloading a file alone does not mark the run saved in Vault. No fallback writes private reports into Definedge's page storage.

The earlier raw `Cannot read properties of undefined (reading 'local')` failure did not retain a recovery copy. A page still running that older code must be refreshed to load the fix; run both submissions again to obtain verified setting links. Previously saved Vault records remain separate from the failed write.

Chrome requires both the extension and host page to reload after content-script changes. [Chrome reload guidance](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#when_to_reload_the_extension). Extension-local storage requires the already-declared storage permission. [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Enable Experiments after an update

Reload the existing Backtest Vault extension on Chrome's Extensions page, refresh RZone, and reopen Vault. Preserve any pending recovery download before refreshing. Choose **New test** for the guided setup; **Experiments → Use a saved run** keeps the existing-baseline route. Live controls are available only inside the installed extension. Begin with a small Candle/Price test. P&F/Renko live execution remains gated pending separate acceptance tests. See [Experiments](EXPERIMENTS.md).

After an interrupted trial, inspect its source report before refreshing. **Check saved result** verifies the saved trial's identity, submitted settings and source lifecycle. An older result without this receipt stays available in the archive but cannot prove a new automatic trial completed. An expired execution lease cannot be revived by a late heartbeat; review the interrupted trial rather than submitting it again automatically.
