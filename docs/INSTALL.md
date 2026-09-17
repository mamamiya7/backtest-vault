# Installation and troubleshooting

## New installation

Download the complete **backtest-vault-0.14.0.zip** asset from [Releases](https://github.com/mamamiya7/backtest-vault/releases/latest), extract everything, and open the **BacktestVault** folder. Do not download only a setup script. Windows and Linux use the same ZIP.

| System | Run | Default permanent extension folder |
| --- | --- | --- |
| Windows 10/11 | Double-click **Setup.cmd** | **%LOCALAPPDATA%\BacktestVault\extension** |
| Linux desktop | **bash setup.sh** | **~/.local/share/backtest-vault/extension** (or under XDG_DATA_HOME) |

Setup verifies the packaged files and prints the permanent folder. In Chrome, enter **chrome://extensions**, enable **Developer mode**, select **Load unpacked**, and choose that folder. It contains **manifest.json**. Pin Vault from the puzzle-piece menu. The extension runs inside Chrome; there is no separate app/server to launch afterward.

No Python, Node.js, Git, npm, administrator rights, or dependency downloads are needed. Windows setup uses ordinary built-in commands, not a PowerShell script, and does not change execution policies. Linux uses Bash and standard GNU utilities. Application Control or browser management can still block scripts or unpacked extensions; ask the device administrator for an approved route rather than weakening policy.

Open **START-HERE.html** for the offline illustrated guide. To install without a helper, keep the extracted release in a permanent folder and load its **extension** subfolder directly. For a developer source checkout, load **dist** instead. This is an unpacked extension distribution, not a signed native installer or Chrome Web Store listing. [Chrome distribution documentation](https://developer.chrome.com/docs/extensions/how-to/distribute)

## Update an existing installation

1. In Vault's library, click **Back up all**. Preserve any pending recovery download and stop active studies before closing Vault and RZone tabs.
2. Download and extract the complete new release into a separate folder.
3. In Chrome's Extensions page, open Vault's **Details** and find **Loaded from**. Use that exact extension folder. Older source installs usually use a folder named **dist**.
4. Run **Update.cmd** on Windows, or **bash update.sh** on Linux. Paste the existing folder when prompted. You can also pass it explicitly: `Update.cmd --target "existing folder"` or `bash update.sh --target "existing folder"`.
5. Click **Reload** on the existing Chrome extension, reopen/refresh RZone, and reopen Vault.

**Keep the same extension and folder.** Browser-local records belong to that extension ID in that Chrome profile. Loading a different folder can create a separate empty archive; uninstalling can delete extension storage. The updater replaces application files only and does not access browser profiles, research records, or credentials. Moving to a new computer/profile requires a JSON backup and import.

The helper validates the source before replacing anything, stages files, backs up overwritten runtime files, writes the manifest last, and verifies the result. A copy failure attempts restoration and reports any retained recovery path. Windows removes temporary backup copies after a successful install/restoration; Linux retains a sibling backup directory. These are **application-file copies**, not research backups. Interrupted power loss or forced process termination can require manual recovery; do not reload an incomplete update. Keep the old release ZIP and your JSON backup.

Both helpers recognize the current manifest template (with a different version allowed). For a customized/older unsupported manifest or a manual update, copy the new package's **extension** contents into the existing loaded folder, replacing matching runtime files, then reload the existing extension. Review custom manifest identity/permissions deliberately; never discard a custom identity key. Do not delete unrelated files.

Setup does not fetch future versions automatically. Use each complete tested Vault release. Helpers accept `--target`, `--no-open`, and `--non-interactive` for scripted installation; update requires an existing Vault target. No helper performs Chrome's approval click.

## Start your first test

Sign in to RZone as usual, then open Vault using the extension toolbar. **You do not need to complete or save a backtest first.**

1. Vault opens **My studies**. Choose **New test**; the journey highlights **Set up**, followed by **Run tests** and **Review results**.
2. With one available RZone tab, Vault loads its choices automatically. With several tabs, select one and click **Connect RZone**. RZone comes forward briefly while Vault reads its controls, then you return to Vault. If you switch tabs yourself, Vault leaves your chosen tab active. Connecting does not submit a backtest. If Vault cannot find Momentum Trading BackTesting, open RZone's Research menu as prompted, then reconnect.
3. Set up the strategy and select **Group**. Open **More strategy settings** for weights and secondary strategy controls. For **Radar**, **Strategy 1, 2 or 3**, or **Exit Strategy**, choose **On**, then a category and rule. Native dropdowns load automatically, even if source rows started off. For strategy/exit **My / Public**, enter a name or keyword and click **Search**, then select a matching rule. Choose **Off** to skip a period/filter or **Test both** to compare separate On and Off runs. Add **Test values** beside a number or menu to compare values or a range. **Test period** and **Portfolio** follow below; expand **Execution settings** or **Portfolio limits** for their additional controls. **Choose dates** sits beside the Test period heading; use Test values to add date variations. Use **Recheck all choices** after adding or changing rules in RZone.
4. On the same page, set dates, rank criteria, chart/selection, exits and portfolio sizing. **More strategy settings** opens the secondary strategy controls. Then click **Review … tests**, review the count and comparison rules, and click **Run … tests**. Leaving all variation controls unused runs the current setup once. The journey itself never submits a test.
5. Leave RZone open and avoid editing its settings while the queue runs. Vault saves each completed report automatically. When the tests finish, **View results** opens the saved evidence. Use **Export study** for a backup of that study, or **Back up all** on the library page. **Compare results** compares saved runs across studies.

**My studies** keeps your saved work available. An unfinished setup can also be reopened with **Continue setup** while you navigate in the same open Vault tab. That unsaved draft does not survive a tab refresh or close.

The editor supports NSE and Price selection under Candle, P&F and Renko, with separate main/execution chart controls. The first connection checks all three chart menus; subsequent connections reuse those menus within the same local day and RZone document session. Recheck all choices forces a fresh scan. Refreshing RZone starts a new document session and requires another check. Current settings are read fresh every time. P&F/Renko automatic execution remains gated pending its own live write acceptance. The user reports normal Candle tests working; this does not prove every combination.

To continue an existing saved baseline, use **My studies → Use a saved run**, or **Test variations** on the run. That workflow requires the RZone tab's fixed settings to match the saved baseline. You can also work manually in RZone: submit the momentum and portfolio tests, wait for the report and all trade rows, then click **Save backtest**.

## Standalone viewer

Run `npm run preview`. The demo URL uses fictional records. Remove `?demo=1` to open this browser origin's separate archive and import a JSON backup. Serving the files over localhost is the supported viewer workflow.

The standalone viewer cannot directly read Chrome extension storage or connect to RZone. Export from the extension and import the JSON file in the viewer. Use the installed Vault for a new connected test; the demo uses fictional choices and results only.

## Common problems

| Symptom | What to check |
| --- | --- |
| Manifest missing | Load the permanent **extension** folder printed by setup, or **dist** for a source checkout. Select the folder containing manifest.json. |
| Save controls missing after an update | Reload the extension, then refresh Definedge. |
| Save says it cannot read `local`, or Vault is disconnected | The extension storage API is unavailable in that tab. Reload the same extension and then refresh Definedge. In v0.4.1 or later, download any recovery backup before refreshing. Submit both backtests again if settings were not retained. |
| Save reports incomplete trade pages | Keep the report open and wait for loading to finish. Retry after the site is stable. Partial captures intentionally fail. |
| Settings were not linked | Submit both strategy and portfolio backtests after capture has loaded. Do not reinterpret the currently visible form as evidence for an older report. |
| Blank library in the viewer | It has separate storage. Import an exported JSON backup. |
| Import is disabled | You are in demo mode. Open my archive to import. |
| No source tab is available | Open RZone, sign in and return to the installed Vault. Refresh RZone after an extension update. Close existing dialogs only after preserving any unsaved report. |
| Connect stays on Reading available settings | Version 0.8.1 bounds the request to 70 seconds while the page is active and displays a retry error beside Connect. RZone's Vault bar shows the reading stage or source error. After updating, reload the same extension and refresh both pages; preserve any pending report first. Retry only when the source is ready. Connecting never submits a backtest. |
| Source dialog did not close | Version 0.8.3 brings RZone forward during connection and checks the actual dialog state after delayed timer callbacks. If the error remains, open RZone and let its settings dialog finish closing; close it manually if needed, then retry Connect in Vault. Preserve any existing report before closing it. |
| A dropdown is missing a recently added rule | Use **Recheck all choices**, then choose the intended category. For strategy/exit **My / Public**, enter a keyword and click **Search**. No matches refers to that query; unavailable old selections need review. |
| Dependent choices never finish loading in an older version | Update to v0.14.0, reload the existing extension and refresh RZone/Vault. My and Public use searchable fields, which older readers incorrectly expected to be dropdowns. |
| Group could not be confirmed | Recheck all choices and select a Group from the searchable dropdown. Execution still requires the same exact choice to exist in RZone. |
| Group list did not load | Let RZone finish loading its Group search, close that menu, then retry Connect or Recheck all choices. Vault preserves your entries and does not run a test after a failed read. |
| RZone settings changed while reading Group | Let the named control finish loading and retry Connect or Recheck all choices. Vault waits for initial controls to settle and stops if settings change during discovery. |
| Refreshing choices seems to open RZone settings | This reads the available controls and may change a rule source. It does not submit a backtest. **Run** starts the calculations. |
| A study finishes almost instantly | Check the workspace label. **Generate … sample results** creates fictional examples without contacting RZone. Real execution uses **Run … tests** inside the installed extension. Inspect **Execution evidence** for source submission and capture times. |
| A duplicate import adds zero runs | Existing IDs stay unchanged. This prevents accidental overwrites. |
| CAGR / annualized return is missing | Neither source value was available. The summary prefers CAGR and otherwise shows Annualized return, with the matching label. |
| Both Renko price modes are selected | This is an ambiguous source form state. Review the record; Vault preserves both settings. |

If reporting a problem, include the version, chart type, steps, and a fictional reproduction. Do not attach a private archive to a public issue.

## Recovering a failed storage write

Version 0.4.1 checks whether extension storage exists and handles rejected writes. If a report passes capture checks but cannot be written, it shows **Not saved to Vault**, keeps that run in this tab, and offers **Download recovery backup**. Confirm the JSON file finished downloading before refreshing or closing the tab. After reloading the extension, open Vault and use **Import runs** to restore it. The recovery file contains only that captured run, including its original settings linkage and warnings; it is not a backup of the whole library or benchmark collection.

**Retry captured run** attempts to write the same captured values and ID. It does not read a different report that happens to be open later. No partial trade capture gets a recovery file. A successful storage write clears the pending recovery controls; downloading a file alone does not mark the run saved in Vault. No fallback writes private reports into Definedge's page storage.

The earlier raw `Cannot read properties of undefined (reading 'local')` failure did not retain a recovery copy. A page still running that older code must be refreshed to load the fix; run both submissions again to obtain verified setting links. Previously saved Vault records remain separate from the failed write.

Chrome requires both the extension and host page to reload after content-script changes. [Chrome reload guidance](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#when_to_reload_the_extension). Extension-local storage requires the already-declared storage permission. [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Continue studies after an update

Reload the existing Backtest Vault extension on Chrome's Extensions page, refresh RZone, and reopen Vault. Preserve any pending recovery download before refreshing. Choose **New test** for the guided setup; **My studies → Use a saved run** keeps the existing-baseline route. Live controls are available only inside the installed extension. Begin with a small Candle/Price test. P&F/Renko live execution remains gated pending separate acceptance tests. See [Studies, tests and results](EXPERIMENTS.md).

After an interrupted trial, inspect its source report before refreshing. **Check saved result** verifies the saved trial's identity, submitted settings and source lifecycle. An older result without this receipt stays available in the archive but cannot prove a new automatic trial completed. An expired execution lease cannot be revived by a late heartbeat; review the interrupted trial rather than submitting it again automatically.
