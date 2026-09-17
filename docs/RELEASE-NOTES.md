# Backtest Vault 0.14.0 — installable preview

One complete package for Windows and Linux. No Node.js, Python, Git, npm, administrator access, or background server is needed to use the Chrome extension.

## Changes

- Follow one study through **Set up → Run tests → Review results**, with the current stage and next action visible. The stage indicator only shows progress; it cannot submit or restart a test.
- Start at **My studies**, create work with **New test**, and use **Compare results** for comparisons across saved runs. An existing run offers **Test variations**.
- Keep strategy, dates and portfolio on one page, with **More strategy settings** for secondary controls. **Review … tests** opens the final check; only **Run … tests** starts calculations.
- Return to an unfinished form with **Continue setup** while the same Vault tab stays open. Refreshing or closing the tab clears that unsaved draft; saved studies stay in the archive.
- Open completed evidence with **View results**, export with **Export study**, or prepare a separate validation test under **Test on another period**.
- Existing date controls, Test values, saved-only progress, reduced motion, deletion protections and execution safeguards remain. Source automation support has not expanded.

## Install

Download **backtest-vault-0.14.0.zip**, extract everything, and open the **BacktestVault** folder.

- **Windows:** double-click **Setup.cmd**.
- **Linux:** run **bash setup.sh** from that folder.
- In Chrome, enter **chrome://extensions**, enable **Developer mode**, choose **Load unpacked**, and select the permanent extension folder printed by setup.

Chrome's approval step is required. This is an unpacked extension distribution, not a Chrome Web Store listing or signed native installer. The offline **START-HERE.html** guide includes the complete path and a manual installation route.

## Existing installations

Back up your Vault library, save any pending report, and close Vault/RZone tabs. Run **Update.cmd** or **bash update.sh** and provide the **same extension folder already loaded in Chrome** (the original `dist` folder for source installations). Reload the existing extension and refresh RZone and Vault. Do not uninstall it or load a second copy; browser storage belongs to the existing extension/profile.

Setup uses built-in Windows commands or standard Linux utilities, validates the payload, and backs up replaced files during the update. Failed restoration retains a recovery path. It does not change security policies or fetch a runtime. A managed device can still prohibit scripts or unpacked extensions; use the administrator's approved route.

## Release checks

Release publication waits for the complete application suites plus extracted-package installation checks on Windows and Linux. These exercise a new install, repeat install, update, path handling, file preservation, invalid targets and damaged downloads. Every package contains file checksums; the attached SHA256SUMS verifies the ZIP.

Strategy execution behavior is unchanged from v0.10.0. P&F/Renko setup and dropdown discovery are available; automatic execution remains gated pending separate live acceptance. This release does not broaden that validation claim.
