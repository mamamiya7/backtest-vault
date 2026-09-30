# Launch operations — account edition

The code is prepared; payment collection and public email login are not active until owner services are configured and acceptance passes. The accepted RZone extension remains usable throughout this setup.

## Account setup order

1. **Supabase:** owner signs in and accepts its terms; create a project, select a nearby region, and keep database credentials in the provider's secret controls. Run `server/schema.sql`. Set the email template to include `{{ .Token }}`. Enable email signup and confirm code delivery.
2. **Email sender:** use a sender/domain the owner controls and configure custom SMTP. The default Supabase mail service sends only to team addresses and is unsuitable for public signup. Verify sender DNS and check spam placement. Do not disable email verification to work around delivery problems.
3. **Razorpay:** owner completes merchant/KYC and bank verification. In test mode create a monthly, interval-one, INR 89900-paise plan. The customer-facing amount is **₹899/month**; finalize tax/invoice presentation before enabling live checkout. No agent should submit identity/bank details or accept provider contracts on the owner's behalf.
4. **Hosting:** the preferred free account host is the existing Supabase project's Edge Functions. Build the single-file function with `npm run accounts:edge`; see the Supabase hosting section below. No separate VPS/domain is required for its HTTPS address. `render.yaml` remains an optional Docker alternative; its free service can sleep. Add secrets through host environment settings, never an issue, chat, command line or repository.
5. **Verify:** run `node scripts/launch-preflight.cjs` in the configured host, then `node scripts/launch-preflight.cjs --remote --origin=https://YOUR_API`. These are read-only checks; they do not send email, create a subscription, reserve a run or fetch customer rows. Successful preflight does not replace real email/payment acceptance.
6. **Payment notifications:** configure `/billing/webhook`, a distinct strong secret and subscription/payment/refund events. In test mode verify a paid cycle, duplicate notifications, cancellation, expiry and refund. Do not simulate paid access in production by editing entitlement rows.
7. **Live activation:** set live provider keys and the live fixed-price plan, `NODE_ENV=production`, and exact Store extension origins. Run preflight with `--live --remote`. Configure the extension's API origin with the existing build tool and package the exact configured build. Do not point customers at the unconfigured candidate.

## Supabase first, while merchant verification is pending

The server can run email login and the lifetime Community allowance with only Supabase and exact `ALLOWED_ORIGINS`. Leave **all four** `RAZORPAY_*` variables absent. Payment endpoints return an explicit unavailable error without contacting Razorpay or creating checkout reservations. Partial payment configuration deliberately prevents startup. Existing paid accounts cannot refresh billing without its provider configuration; this mode is for initial Community setup, not a shortcut around paid reconciliation.

Run `node scripts/launch-preflight.cjs --community-only --live --remote --origin=https://YOUR_API` after secure hosting configuration. This checks Supabase and the API without requiring a Razorpay plan. The ordinary preflight still requires billing. A passing Community check never certifies paid launch.

The Supabase free dashboard currently requires custom SMTP before editing email templates. Prepare a domain owned by the operator, verify its sender through the chosen email service, and enter its SMTP credentials directly in Supabase. No domain or sender has been selected yet. Buying a domain/service and creating credentials require the owner's involvement; never invent a sender or use someone else's domain.

After SMTP is configured, install both templates: **Confirm sign up** → `server/email-templates/confirm-sign-up.html`, subject `Confirm your Backtest Vault email`; **Magic link or OTP** → `server/email-templates/sign-in.html`, subject `Your Backtest Vault sign-in code`. Both use `{{ .Token }}` because first-time and returning users can receive different templates. Keep email confirmation on, anonymous sign-in off, eight-digit OTPs and 600-second expiry. Confirm delivery for a new address and a returning address before customer distribution.

The owned project's three account tables and eight restricted functions are deployed. SQL Editor verification confirmed RLS and denied direct reads for anonymous and authenticated roles, and execute permission only for the server role. `server/verify-community.sql` checks the deployed allowance inside a rolled-back transaction; it does not send email or retain its synthetic identity. Production SMTP delivery and the hosted API remain separate acceptance gates.

## Free Supabase account hosting

`supabase/functions/vault-accounts/index.ts` is generated from the existing account provider and shared HTTP handler plus a bounded Fetch adapter. Run `npm run accounts:edge` and `npm run test:hosting` after changing any shared source. Deploy that single file as **vault-accounts** in the existing project's Edge editor, or with the official CLI. No provider credentials belong in the file. The function uses the project's injected Supabase settings; additional settings belong in Secrets.

The endpoint is `https://PROJECT.supabase.co/functions/v1/vault-accounts`. Function routing accepts its exact mounted path; the same authenticated account/atomic quota and raw-byte signed billing checks apply. The hosted endpoint is separate from website hosting. It is not a customer-facing landing page.

**Closed by default:** leave `PUBLIC_EMAIL_READY` absent. `/health` reports `{ok:true,ready:false}` and account/login/payment routes return unavailable without sending email or contacting providers. Foreign origins are rejected. This permits hosting preparation while the owner keeps costs at zero and postpones an owned sender domain. It is not an activated email-login or paid release. Preflight deliberately rejects `ready:false` as launch-ready.

Before enabling, configure the verified SMTP sender and both code templates; securely set exact `ALLOWED_ORIGINS`, complete provider settings and acceptance, then set `PUBLIC_EMAIL_READY=true`. Blank origins remain closed; wildcard or non-extension origins fail startup. Gateway `verify_jwt=false` is needed for first login/health/payment notifications; it does not remove application authentication. Each private request still verifies its bearer session with Supabase, and every webhook verifies its raw HMAC before reconciliation. Never substitute gateway bypass for these checks.

The local rate limiter is per function instance. It is a supplementary control, not a distributed abuse barrier. Before public activation verify Supabase Auth email/IP limits, sender daily limits and platform/network controls under concurrent instances. Runtime remote-address information is used instead of caller-supplied forwarding headers. A shared platform address may conservatively rate-limit multiple users.

Configure a candidate only after acceptance: `node scripts/configure-accounts.cjs --origin https://PROJECT.supabase.co/functions/v1/vault-accounts`. The client stores the exact public origin plus a validated function path; manifest/CSP still permit only that one HTTPS host. No provider keys are shipped. Keep the installed accepted RZone extension unchanged while login is pending.

For the public website, use a free static host with its supplied subdomain, such as Cloudflare Pages. This does not create an email sender domain. A free-provider account/terms require the owner's participation; do not publish the draft private preview as a finished public service. Resend's free sending allowance still requires an owned verified domain. Do not advertise public email login before it works.

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
