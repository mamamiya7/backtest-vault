# Backtest Vault 0.16.1 — installable preview

One complete package for Windows and Linux. No Node.js, Python, Git, npm, administrator access, or background server is needed to use the Chrome extension.

## Changes

- **Use these settings** on a saved trial or report returns to the full Step 1 form with its strategy, dates, exits and portfolio inputs. Edit and run to save a new study; original evidence stays intact.
- Show every study's own **Created** date and time, separate from its baseline name.
- Reuse daily shared Pre/Popular native dropdown menus across RZone refreshes and new tabs. Current settings, Group and private choices are checked afresh; **Recheck all choices** still forces a complete scan.
- Preserve copied edits through reconnects, current-menu validation, single paired date controls, comparison rules and execution safeguards. Removed or unsearched choices need review; unsupported chart execution remains gated.

## Install

Download **backtest-vault-0.16.1.zip**, extract everything, and open the **BacktestVault** folder.

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
