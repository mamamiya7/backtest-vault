# Backtest Vault 0.19.0 — installable preview

One complete package for Windows and Linux. No Node.js, Python, Git, npm, administrator access, or background server is needed to use the Chrome extension.

## Changes

- Add NSE/Price backtest execution for Candle, P&F and Renko, with independent main and exit charts. Apply each chart's construction and price-mode settings alongside the reviewed strategy, dates, filters and portfolio inputs.
- Preserve exact Relative Strength and Market Trend Filter settings. Handle the observed Relative Strength heading changes while retaining raw captured labels and the identity of older saved templates.
- Check the connected RZone page's advertised chart support before Run. If it still has the older runner, Vault keeps variant execution disabled and asks you to refresh RZone and reconnect.
- Keep fresh source-submission evidence, complete trade/chart capture and verified saves before advancing the queue. Interrupted or uncertain trials remain available for review without automatic replay.
- Reuse today's existing choices and preserve interrupted-scan protection. This update does **not** require **Recheck all choices**. Saved reports, study history and installer behavior remain unchanged.

## Verification

Focused setup, experiment, interface and workbench suites passed, along with runner cases 86–101. The runner checks include **41 simulated saves** across variant charts, Relative Strength and Market Trend Filter, plus rejection of stale or reused evidence. These are isolated fixture checks.

Two live batches through the installed Vault passed exported-record verification: **three P&F trials** with main box sizes 0.25, 0.5 and 1, and **three Renko trials** with main Percent brick sizes 0.5, 1 and 2. Each used a separate source submission, captured its planned settings and complete report, and acknowledged storage before the next trial. A separate mixed P&F-entry/Renko-exit run also passed. Private reports are excluded from this repository.

This establishes the tested batch flows, not every live filter/chart combination or independent correctness of RZone's financial calculations. The automated checks cover additional chart pairs, Relative Strength, Market Trend Filter and Renko construction modes.

## Install

Download **backtest-vault-0.19.0.zip**, extract everything, and open the **BacktestVault** folder.

- **Windows:** double-click **Setup.cmd**.
- **Linux:** run **bash setup.sh** from that folder.
- In Chrome, enter **chrome://extensions**, enable **Developer mode**, choose **Load unpacked**, and select the permanent extension folder printed by setup.

Chrome's approval step is required. This is an unpacked extension distribution, not a Chrome Web Store listing or signed native installer. The offline **START-HERE.html** guide includes the complete path and a manual installation route.

## Existing installations

Back up your Vault library, save any pending report, and close Vault/RZone tabs. Run **Update.cmd** or **bash update.sh** and provide the **same extension folder already loaded in Chrome** (the original `dist` folder for source installations). Reload the existing extension and refresh RZone and Vault. Do not uninstall it or load a second copy; browser storage belongs to the existing extension/profile.

Setup uses built-in Windows commands or standard Linux utilities, validates the payload, and backs up replaced files during the update. Failed restoration retains a recovery path. It does not change security policies or fetch a runtime. A managed device can still prohibit scripts or unpacked extensions; use the administrator's approved route.

## Release checks

Release publication waits for the complete application suites plus extracted-package installation checks on Windows and Linux. These exercise a new install, repeat install, update, path handling, file preservation, invalid targets and damaged downloads. Every package contains file checksums; the attached SHA256SUMS verifies the ZIP.

Execution supports the advertised Candle, P&F and Renko main/exit adapters with NSE and Price selection. Other markets and non-Price execution remain unavailable. Automated fixture checks and installed live checks are separate; their scopes are described above.
