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

The package contains no remote origin, deployment credential, account data, or installed dependencies. Its workflow runs local tests on pushes and pull requests; it does not deploy anything.

## Separate distribution choices

The source repository includes tests and documentation. Chrome users load its dist directory. The standalone UI can be hosted as static files later, but publication or hosting is a separate action. This project does not configure a public demo URL automatically.
