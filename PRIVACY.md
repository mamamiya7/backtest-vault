# Privacy

Backtest Vault has no account, analytics, advertising, telemetry, or remote storage service. Its runtime uses packaged code and assets.

## Stored locally

The extension stores captured reports in Chrome local extension storage. The standalone viewer uses its own IndexedDB database on the current browser origin. Reports can include strategy settings, dates, universe names, trades, charts, run names, and research notes. Local data is not an independent backup.

**Back up all** and **Export run** download JSON files. CSV and SVG exports download only the requested view. These files are not uploaded by Vault. Users control any later sharing.

When an extension storage write fails, the captured run remains temporarily in the content script's memory. **Download recovery backup** exports only that run to a local JSON file. It is lost from memory when the page closes or refreshes, and it is never silently stored in Definedge's page storage.

Imported index levels, dates, basis and source filenames are stored locally in a separate benchmark collection. **Back up all** includes this collection; **Export run** does not. The strategy analysis uses local calculations. It does not send records to an AI service or fetch index history automatically. Opening an external methodology or data-source link visits that website in the browser.

The extension's content script runs only on the configured Definedge domain. It reads the relevant backtest form/report and advances trade pagination during a save. Definedge itself is a separate service with its own data practices.

Column order and visibility are stored separately as appearance preferences: Chrome extension storage in the extension, and localStorage in the standalone viewer. They contain column identifiers only, are excluded from JSON research backups, and can be restored with Reset columns. Sorting is temporary. Demo preferences use memory and never access these durable stores.

## Demo mode

`?demo=1` selects a memory-only library before opening extension storage or IndexedDB. Demo records are fictional, imports are disabled, and changes disappear on reload. Demo exports remain marked as synthetic. Opening **my archive** leaves demo mode and opens the current environment's normal local library.

## Keeping and removing data

Export a backup before clearing browser data, changing profiles, removing the extension, or moving devices. Clearing site data removes the standalone viewer's records for that origin; removing the extension may remove its local records. The app does not currently offer individual run deletion.

A public copy of this source repository must not contain personal archives or report screenshots. The publication packager uses an explicit allowlist.
