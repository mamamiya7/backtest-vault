# Backtest Vault 0.18.4 — installable preview

One complete package for Windows and Linux. No Node.js, Python, Git, npm, administrator access, or background server is needed to use the Chrome extension.

## Changes

- Fix false cache rejection caused by reordered menus, inactive controls and valid alternate form layouts.
- Reuse P&F dropdown choices when reversal size changes.
- Keep interrupted discovery paused across page reloads, instead of repeatedly scanning the same day.
- Preserve today's existing cache; this update does not require Recheck all choices.

- Fix a stale running-test lock after RZone refresh, including after an extension reload. Confirm the live page before releasing old ownership.
- Keep saved reports and daily choices; recover verified results and retain unfinished trials for review without automatic replay.
- Ignore delayed old-page messages and protect genuinely active tests.

- Open Vault now opens the exact portfolio report. If the visible completed report has not been saved, Vault saves it first. Already saved reports are not duplicated.
- Use these settings now correctly restores real saved inputs into New test. The saved-run picker also includes eligible real reports.
- Missing report links and interrupted saves show a clear message. Real and sample settings remain separate.
- Source calculations, chart execution gates and installer behavior are unchanged.

## Install

Download **backtest-vault-0.18.4.zip** when this release is published, extract everything, and open the **BacktestVault** folder.

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
