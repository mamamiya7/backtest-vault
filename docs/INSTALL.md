# Installation and troubleshooting

## Chrome extension

Load the unpacked **dist** directory, which contains manifest.json. Selecting the project root causes Chrome's “Manifest file is missing or unreadable” error.

Use the same folder for future reloads. Back up first, then reload the extension and refresh both Definedge and Vault to load changed scripts. Removing the extension is not required for an update.

Sign in to Definedge as usual. Run the momentum submission, then the portfolio submission. Wait until the report and trade rows appear before clicking **Save backtest**. Wait for completion while the saver visits every trade page. Open Vault using the extension toolbar.

## Standalone viewer

Run `npm run preview`. The demo URL uses fictional records. Remove `?demo=1` to open this browser origin's separate archive and import a JSON backup. Serving the files over localhost is the supported viewer workflow.

The standalone viewer cannot directly read Chrome extension storage. Export from the extension and import the JSON file in the viewer.

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
| An experiment finishes almost instantly | Check the workspace label. **Generate sample results** creates fictional examples without contacting RZone. Real execution uses **Start experiment** inside the installed extension. Inspect **Execution evidence** for source submission and capture times. |
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

Reload Backtest Vault on Chrome's Extensions page, refresh the RZone tab, and reopen Vault. Choose Experiments or Create experiment on a saved run. Live controls are available only inside the installed extension; the localhost viewer can prepare plans and run a fictional simulation. Begin with a small Candle plan and a matching source baseline. P&F/Renko live execution remains gated pending separate acceptance tests. See [Experiments](EXPERIMENTS.md).

After an interrupted trial, inspect its source report before refreshing. **Check saved result** verifies the saved trial's identity, submitted settings and source lifecycle. An older result without this receipt stays available in the archive but cannot prove a new automatic trial completed. An expired execution lease cannot be revived by a late heartbeat; review the interrupted trial rather than submitting it again automatically.
