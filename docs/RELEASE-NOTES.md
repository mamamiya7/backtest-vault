# Backtest Vault 0.17.5 — installable preview

One complete package for Windows and Linux. No Node.js, Python, Git, npm, administrator access, or background server is needed to use the Chrome extension.

## Changes

- Search symbols in one field for Relative Strength and Market Trend Filter; show every returned match and retain selected Test values.
- Reuse same-day, same-market symbol searches across both filters, including after page refreshes.
- Keep search-result counts distinct from a full-market catalogue; exact symbol IDs and exchanges remain verified.

- Fix false “RZone choices changed” errors caused solely by reordered properties in stored dropdown metadata. Actual choice values, order and source identities remain checked.
- Stop chart or filter changes from restarting a failed full choice scan in the same source session and day. Recheck all choices retries explicitly; a new day permits a new pass.

- Reuse complete daily dropdown choices across RZone refreshes and tabs, including Group, private categories and loaded filter symbols. Keep Recheck all choices as the manual override.
- Prevent delayed symbol responses from leaving orphan menus; handle native no-match results and wait for dialog close animations within the connection deadline.

- Wait through RZone's normal symbol-loading spinner and read only settled results.
- Close native RZone symbol lists correctly after reading their choices.
- Clear interrupted filter-loading states when returning to setup, show failed source reads, and bound symbol-search waits.

- Radar's enable control is beside its rule dropdown.
- Universe × Timeframe Test values produce every selected combination, with results grouped by matching conditions.
- Relative Strength and Market Trend Filter now have dedicated settings and Test values, including their source-specific rule lists and benchmark searches.
- Automated trials apply and verify complete filter settings before saving results. Discovery restores the source form, and saved runs retain the full filter configuration.

## Install

Download **backtest-vault-0.17.5.zip** when this release is published, extract everything, and open the **BacktestVault** folder.

- **Windows:** double-click **Setup.cmd**.
- **Linux:** run **bash setup.sh** from that folder.
- In Chrome, enter **chrome://extensions**, enable **Developer mode**, choose **Load unpacked**, and select the permanent extension folder printed by setup.

Chrome's approval step is required. This is an unpacked extension distribution, not a Chrome Web Store listing or signed native installer. The offline **START-HERE.html** guide includes the complete path and a manual installation route.

## Existing installations

Back up your Vault library, save any pending report, and close Vault/RZone tabs. Run **Update.cmd** or **bash update.sh** and provide the **same extension folder already loaded in Chrome** (the original `dist` folder for source installations). Reload the existing extension and refresh RZone and Vault. Do not uninstall it or load a second copy; browser storage belongs to the existing extension/profile.

Setup uses built-in Windows commands or standard Linux utilities, validates the payload, and backs up replaced files during the update. Failed restoration retains a recovery path. It does not change security policies or fetch a runtime. A managed device can still prohibit scripts or unpacked extensions; use the administrator's approved route.

## Release checks

Release publication waits for the complete application suites plus extracted-package installation checks on Windows and Linux. These exercise a new install, repeat install, update, path handling, file preservation, invalid targets and damaged downloads. Every package contains file checksums; the attached SHA256SUMS verifies the ZIP.

Relative Strength and Market Trend Filter extend the Candle/Price runner. P&F/Renko main and execution charts remain available for setup and dropdown discovery; automatic execution remains gated pending separate live acceptance. Automated fixture checks do not establish installed Chrome or live RZone acceptance.
