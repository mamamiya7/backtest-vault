# Contributing

Use Node.js 24+, install the locked dependencies with `npm ci`, and run `npm test` plus `npm run check` before submitting a change. Start the synthetic workspace with `npm run preview`.

## Preserve the archive contract

- Capture submitted settings, never later visible settings assigned to an older report.
- Keep original labels, values, missing metrics, and zero-quantity trades.
- Fail a save if a trade page cannot be captured. Do not silently save a partial report.
- Keep submission warnings and conflicting controls visible.
- Use conservative field-layout matching. Add synthetic fixtures for a newly supported layout.
- Render imported text as text, sanitize SVGs, and escape spreadsheet formulas.
- Preserve existing IDs on import. Do not add a migration that rewrites research data without a documented recovery path.
- Keep the extension limited to the existing Definedge domain. No credentials, analytics, remote scripts, or automatic order execution.

## UI changes

Use the existing CSS tokens. Keep numeric measures right-aligned, signs explicit, and units accurate. Counts remain counts; arrow annotations never imply a negative number. Test keyboard tabs, narrow layouts, long values, empty states, warnings, and comparison selections hidden by filters.

Use only fictional fixtures for issues, screenshots, and documentation. Do not submit your real JSON archive, account details, private notes, or original site report screenshots.

## Pull requests

Explain the trigger, the resulting behavior, and validation. Keep changes focused. If source-page behavior cannot be verified live, say so. Local simulated tests are not proof that a live vendor form still matches.
