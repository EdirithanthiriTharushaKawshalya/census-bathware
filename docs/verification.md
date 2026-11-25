# Verification and connection acceptance

## Repeatable checks

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
```

The focused domain suite checks the role matrix, assigned delivery access, exact monetary input, eligible-payment balances, duplicate-variant validation, and snapshot independence.

The Playwright browser suite uses installed Google Chrome, runs against the app without Supabase keys, and checks desktop/mobile public rendering, all protected setup redirects, the missing-connection sign-in response, and the development-only demo. Screenshots and failure traces are written to ignored `test-results/`. It starts a development server on port 3100 if none is running. To repeat against a running production server on port 3101:

```powershell
$env:CENSUS_BROWSER_BASE_URL = 'http://localhost:3101'
$env:CENSUS_BROWSER_PRODUCTION = '1'
npm.cmd run test:browser
Remove-Item Env:CENSUS_BROWSER_BASE_URL
Remove-Item Env:CENSUS_BROWSER_PRODUCTION
```

For a running local Supabase instance with the migrations applied, run `npm.cmd run test:db`. It uses `psql` and defaults to localhost port 54322. `CENSUS_TEST_DATABASE_URL` can override the connection only with a localhost URL. The suite runs in a transaction and rolls back every fixture identity and business record. Use a development database only. It checks anonymous and unapproved access denial, self-role escalation denial, cross-customer/representative/driver isolation, authoritative prices, null line payloads, duplicate order/invoice/payment submissions, cheque requirements/clearance/reversal, invoice snapshots, audit events, and separation of delivery collections from payments.

If Docker is unavailable but Windows PostgreSQL server tools are installed:

```powershell
powershell -NoProfile -File scripts/verify-sql.ps1
# If your local execution policy blocks this trusted script, use a process-only override:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-sql.ps1
```

It creates a new cluster under ignored `.tmp/`, binds only 127.0.0.1:55439, applies minimal auth/storage test contracts, runs the actual migrations/seed/assertions, and stops the cluster in `finally`. It never connects to a remote project. `-PostgresBin 'C:\path\to\PostgreSQL\bin' -Port 55440` overrides binaries/port. This is PostgreSQL verification, **not** full Supabase verification. Its localhost trust authentication is isolated to the temporary test server. Stop it before leaving a shared machine if the host interrupts the script.

## Connected Supabase acceptance checklist

After applying migrations to your chosen project and provisioning users through the trusted script:

1. Use separate private browser sessions for customer A, customer B, representative, office, accounts, driver A, driver B, unapproved customer and management/admin. No application signup should be available. Wrong-password login fails; inactive/unapproved users cannot enter the portal. Sign out and confirm protected navigation returns to sign-in.
2. Customer A can browse trade prices, filter by category/brand/SKU, choose a variant, submit an order and read its confirmation/history. Customer B cannot read A's order or invoice, including direct REST requests by known IDs. A rep can order for assigned customers and cannot submit for an unassigned customer. Office can enter an offline order for an assigned rep; original actor remains office.
3. Retry the same order actor/key concurrently via two REST RPC requests. Exactly one order and one set of lines must exist. Repeat invoice issuance concurrently with different keys: one invoice per order. Repeat payment entry with the same actor/key: one payment and one audit record. `authorization.sql` verifies sequential retries; run concurrent requests against the connected service to verify transport-level behavior too.
4. Change the catalogue price after ordering and issue the invoice. Original ordered price, SKU, descriptions and invoice total must remain unchanged. Archive the product and confirm it cannot be ordered by direct RPC. Upload an image as office, read it as an approved customer and deny anonymous/unapproved/driver reads. Check signed URLs expire. Verify browser form validation and server errors.
5. Record a cash payment; outstanding decreases. Record a pending cheque; outstanding stays unchanged and its value is reserved against duplicate collection. Missing cheque details and overpayment must fail. Clear the cheque, then void a mistaken entry with a reason and record its replacement; audit history must retain before/after states. Try a payment as a driver/rep/customer: denied. Voiding an invoice with active payments must fail.
6. Assign an order to driver A. Driver B cannot see/update it. Driver A records partial quantities and shortage notes. Order progress and fulfilled value update, without issuing an invoice or changing payment totals. Reassign to B and confirm A immediately loses access. Invalid/duplicate/null line updates must fail atomically.
7. Compare customer balances to issued invoice totals minus cleared payments. Pending register and filtered collection totals must reconcile. Test different order/issue/payment dates: reports use the labeled date for each measure. Verify representative totals with invoices issued in a later month. Enquiries must never alter sales totals; profit must remain hidden.
8. Guest access defaults off: public enquiry form absent and anonymous `submit_enquiry` denied. After trusted enablement both activate. Check contact/quantity validation, honeypot handling, 5/email/hour and 100/global/hour limits and private enquiry reads. Disable and retry direct RPC: denied.
9. Verify expired-session refresh, invalid refresh token handling and no cached cross-user responses through your production proxy/CDN. Check 360px mobile delivery use, keyboard focus/labels, screen-reader announcements and invoice print layout.
10. Build with no environment keys: public entry, sign-in and setup render, protected routes show setup, writes never claim success, and production `/demo` is 404. `/demo` during development is read-only fictional data with no authenticated links or actions.

No live Supabase verification can be claimed until these checks are performed against a connected instance. See the README for the checks actually run in this handoff.
