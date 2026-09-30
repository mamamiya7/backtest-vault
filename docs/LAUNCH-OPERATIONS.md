# Launch operations — account edition

The code is prepared; payment collection and public email login are not active until owner services are configured and acceptance passes. The accepted RZone extension remains usable throughout this setup.

## Account setup order

1. **Supabase:** owner signs in and accepts its terms; create a project, select a nearby region, and keep database credentials in the provider's secret controls. Run `server/schema.sql`. Set the email template to include `{{ .Token }}`. Enable email signup and confirm code delivery.
2. **Email sender:** use a sender/domain the owner controls and configure custom SMTP. The default Supabase mail service sends only to team addresses and is unsuitable for public signup. Verify sender DNS and check spam placement. Do not disable email verification to work around delivery problems.
3. **Razorpay:** owner completes merchant/KYC and bank verification. In test mode create a monthly, interval-one, INR 89900-paise plan. The customer-facing amount is **₹899/month**; finalize tax/invoice presentation before enabling live checkout. No agent should submit identity/bank details or accept provider contracts on the owner's behalf.
4. **Hosting:** `render.yaml` prepares a free staging Docker service with no secrets in source. This is an alternative to another managed Docker host. The free service can sleep and is not a production uptime promise. Any paid hosting upgrade needs the owner's spending decision. Add secrets through host environment settings, never an issue, chat, command line or repository.
5. **Verify:** run `node scripts/launch-preflight.cjs` in the configured host, then `node scripts/launch-preflight.cjs --remote --origin=https://YOUR_API`. These are read-only checks; they do not send email, create a subscription, reserve a run or fetch customer rows. Successful preflight does not replace real email/payment acceptance.
6. **Payment notifications:** configure `/billing/webhook`, a distinct strong secret and subscription/payment/refund events. In test mode verify a paid cycle, duplicate notifications, cancellation, expiry and refund. Do not simulate paid access in production by editing entitlement rows.
7. **Live activation:** set live provider keys and the live fixed-price plan, `NODE_ENV=production`, and exact Store extension origins. Run preflight with `--live --remote`. Configure the extension's API origin with the existing build tool and package the exact configured build. Do not point customers at the unconfigured candidate.

## Supabase first, while merchant verification is pending

The server can run email login and the lifetime Community allowance with only Supabase and exact `ALLOWED_ORIGINS`. Leave **all four** `RAZORPAY_*` variables absent. Payment endpoints return an explicit unavailable error without contacting Razorpay or creating checkout reservations. Partial payment configuration deliberately prevents startup. Existing paid accounts cannot refresh billing without its provider configuration; this mode is for initial Community setup, not a shortcut around paid reconciliation.

Run `node scripts/launch-preflight.cjs --community-only --live --remote --origin=https://YOUR_API` after secure hosting configuration. This checks Supabase and the API without requiring a Razorpay plan. The ordinary preflight still requires billing. A passing Community check never certifies paid launch.

The Supabase free dashboard currently requires custom SMTP before editing email templates. Prepare a domain owned by the operator, verify its sender through the chosen email service, and enter its SMTP credentials directly in Supabase. No domain or sender has been selected yet. Buying a domain/service and creating credentials require the owner's involvement; never invent a sender or use someone else's domain.

After SMTP is configured, install both templates: **Confirm sign up** → `server/email-templates/confirm-sign-up.html`, subject `Confirm your Backtest Vault email`; **Magic link or OTP** → `server/email-templates/sign-in.html`, subject `Your Backtest Vault sign-in code`. Both use `{{ .Token }}` because first-time and returning users can receive different templates. Keep email confirmation on, anonymous sign-in off, eight-digit OTPs and 600-second expiry. Confirm delivery for a new address and a returning address before customer distribution.

The owned project's three account tables and eight restricted functions are deployed. SQL Editor verification confirmed RLS and denied direct reads for anonymous and authenticated roles, and execute permission only for the server role. `server/verify-community.sql` checks the deployed allowance inside a rolled-back transaction; it does not send email or retain its synthetic identity. Production SMTP delivery and the hosted API remain separate acceptance gates.

## Store reviewer instructions (draft)

Purpose: independently archive RZone backtests and automate user-approved research batches. No broker orders or live execution are performed.

Review email login, the free-run allowance and the one-account Community/Pro flow. Community includes 50 successfully saved automatic trials once per account. Each combination is one trial; failed or unsaved trials do not count. Pro costs ₹899/month with continued automation and paid reuse/research tools. Basic history reading and exports remain accessible after expiry. A compatible signed-in RZone account is required for real trials, and is separate from Vault billing.

Review permission scope: storage/unlimitedStorage retain the local research archive; the content script is restricted to the stated RZone domain. The configured account origin is used only for verified identity, quota and billing. No remotely hosted JavaScript is executed in the extension. Checkout opens the payment provider's hosted page. Reviewer account access and a legitimate source test account must be supplied securely by the owner; do not place passwords in this document.

## Customer-facing policies to finalize

- Owner/trading name and public support/privacy address.
- Applicable taxes and invoice issuer.
- Cancellation wording, refund eligibility and duplicate-charge handling.
- Account-data retention and deletion-request process, including billing records the operator is required to retain.
- Support response expectations and source-service dependency/outage handling.

A private launch-page preview may show draft policy sections, but those are not final legal terms and must not be advertised as an active checkout or Store listing. Research archives stay local; account deletion does not erase local browser backups. Cancellation is separate from deletion.

## Routine operations

Monitor `/health`, email failures and Razorpay webhook delivery. Investigate held checkout reservations by the exact provider notes before linking or clearing them; never create a second subscription simply because the first request timed out. Review pending runs without automatic replay. Use provider dashboards for disputes and support-assisted account requests. Never log OTP codes, access tokens, secret keys or research payloads. Keep authenticated service error details in private operational logs if needed, not in public support messages.

Official references: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Render blueprint specification](https://render.com/docs/blueprint-spec), [Chrome Store distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution), [Razorpay monthly plans](https://razorpay.com/docs/api/payments/subscriptions/create-plan/).
