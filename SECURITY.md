# Security

Backtest Vault is a preview application. Do not place private research records or credentials in public issues.

## Reporting a vulnerability

If the repository provides GitHub private vulnerability reporting, use its **Security → Report a vulnerability** flow. Otherwise, ask the repository maintainer for a private reporting channel without including exploit details or sensitive data in that request. No security contact address is configured in this source package.

Include the affected version, a minimal synthetic reproduction, expected impact, and the relevant browser version. Use fictional archives.

## Current protections

- Manifest content scripts are restricted to the Definedge origin.
- Runtime assets are local; the extension dashboard disallows network connections through its content security policy.
- Imports validate report structure and limits. SVGs use an element/attribute allowlist.
- Imported strings render as text. CSV exports protect formula prefixes.
- Demo mode does not open durable storage.
- Public packaging excludes private artifacts through an explicit file allowlist and rejects common credential/private-path patterns.

These measures do not establish a completed external security review. Very large archives, browser quotas, source-page changes, or hostile browser extensions can still cause failures. Preserve independent backups.
