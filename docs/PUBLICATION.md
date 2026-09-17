# Public Git publication

The public source repository is [mamamiya7/backtest-vault](https://github.com/mamamiya7/backtest-vault). This guide describes preparing future public source copies without research archives or local development evidence.

## Produce the clean source package

Run `npm ci`, `npm test`, `npm run check`, then `npm run package:public`. The last command copies only its explicit allowlist into a new versioned directory under releases. It stops if that destination already exists and never removes an earlier package.

Publish from that clean copy. Do not publish the private development directory wholesale.

## Review before pushing

- Inspect PACKAGE-MANIFEST.json and the actual files.
- Confirm that screenshots show only fictional demo records.
- Keep personal archives, private handoffs, live report evidence, and local hosting state out of Git.
- Review the included MIT license and attribution.
- Choose the repository name and owner, and enable private vulnerability reporting if available.
- Keep the preview and live-validation limitations in the README.
- Run checks in the clean copy and confirm the demo starts.
- Commit and push only after the repository destination and publication are authorized.

The package contains no deployment credential, account data, or installed dependencies. Branch pushes and pull requests run application and installation checks. Version tags publish the verified installable ZIP as described below.

## Separate distribution choices

The source repository includes tests and documentation. Source users load its dist directory; end users download the complete release ZIP and run its setup helper. The standalone UI can be hosted as static files later, but hosting is separate. This project does not configure a public demo URL automatically.

## Every release includes installation

1. Update package.json, package-lock.json, dist/manifest.json, the capture version badge, footer, README, changelog and docs/RELEASE-NOTES.md together.
2. If runtime files change, update the explicit lists in scripts/build-release.cjs, scripts/package-public.cjs and installer/Setup.cmd. Never add research files by globbing the private project.
3. Run `npm run test:install`. It builds and extracts the actual ZIP, checks every checksum, and installs into isolated folders. `npm run package:release` creates an immutable versioned download under releases. End users need neither Node nor build tools.
4. Review and push the clean public source. Create a `vX.Y.Z` Git tag matching package.json and push it. The tag workflow runs all application suites and both Windows/Linux extracted-package checks, then publishes the exact Linux-job artifact plus SHA256SUMS. A failed check prevents release publication. Existing release assets are never overwritten.
5. Verify the public release/download and its checksum. Keep the preview/live-validation limitations visible. Do not describe installer tests as live RZone acceptance.

The same ZIP serves both platforms. Its installer scripts, line endings, runtime, offline guide and checksums are bundled deterministically. GitHub's automatic Source code archives remain developer checkouts and are not the end-user download.

Installer checks cover a fresh/repeated install, update from the preceding manifest version, non-English/spaced paths, unrelated file preservation, a corrupt/missing payload, invalid targets and linked folders. Application logic is separately checked through the full suites; browser approval/loading remains a manual acceptance boundary.

Windows uses built-in command utilities with no PowerShell script, downloaded executable, registry edits, or administrator requirement. Linux uses Bash and standard GNU utilities without sudo. These choices avoid the runtime bootstrap and path problems observed in the earlier Scanner Research installer. Neither route weakens device policies. See [installation help](INSTALL.md).
