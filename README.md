# Census Bathware

A Next.js 16.4.6 App Router trade portal using TypeScript, Tailwind CSS, npm, and Supabase. Reuses the installed scaffold. No Supabase credentials are required to build or view the public site.

## Existing project: security and image upgrade

The website also has a bundled Capacitor mobile app for Android and iPhone. See [mobile setup, Android APK, iPhone build and release checks](docs/mobile-app.md). Existing Next.js commands still run the website. Use `npm run mobile:dev` for mobile preview or `npm run mobile:apk` to create a test Android APK.

If you already ran the original three migrations, run **only** `supabase/migrations/202611260001_security_and_images.sql` in the trusted Supabase SQL Editor. Do not rerun the old migrations. The new migration is required for protected sign-in, paginated catalogue browsing and optimized uploads.

Add a **fresh** server-only secret to your existing ignored `.env.local` (preserve the URL and publishable key):

```dotenv
SUPABASE_SECRET_KEY=YOUR_NEW_SERVER_ONLY_SUPABASE_SECRET_KEY
```

This key is required only for image uploads, because staff browsers can no longer write directly to Storage and bypass image validation. Never prefix it with `NEXT_PUBLIC_`, put it in Git, or paste it into chat. Use a newly generated key; replace any credentials previously shared in chat. Restart development, or rebuild/redeploy production after applying the migration and setting environment variables. Existing JPEG/PNG photos remain readable. See [security, compression and CDN details](docs/security-performance.md).

## Run on Windows

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. Without keys, the public entry and sign-in page render and protected routes show `/setup`. Development-only `/demo` shows fictional, read-only sample activity. It returns 404 in production and never grants access to authenticated routes or performs writes.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd start
```

The browser suite requires Google Chrome and checks the **unconfigured** app before adding `.env.local`. It launches a local server on port 3100 if needed. The app uses system fonts so builds do not require a Google Fonts download. If a stale development route validator remains after changing routes, stop the old dev server and restart it before checking types. After adding keys for a production deployment, rebuild the app; public environment variables are embedded during the build.

## Connect your Supabase project

1. Create a Supabase project. Keep its database password and secret keys private. Login and business data access use the project URL and **publishable** key; sanitized image uploads additionally require the server-only Storage key described above.
2. Copy the environment example:

   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

   Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project's Connect/API settings. Set `SUPABASE_SECRET_KEY` only on the server for sanitized image uploads. `.env.local` is ignored by Git.

3. Review and apply all four `supabase/migrations/*.sql` files in filename order for a new project through the trusted Supabase SQL Editor, or, **when you choose to apply them to your remote project**, use the CLI:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push --dry-run
   supabase db push
   ```

   Do not include seed data in a production push. No remote migration or seed command was run during implementation.

4. In Supabase Authentication settings, turn off public user signup and configure your production site URL. Create/invite each individual through Auth > Users. Use email/password; have users securely set their own password. Use Supabase's trusted password-recovery process for resets. Never share accounts or put passwords in SQL/Git. There is no public registration or privilege-granting signup trigger.
5. Provision the first admin using `supabase/provision-account.sql` in the trusted SQL Editor. Set the exact existing Auth email, full name, and `admin` role in its three values. This is an administrative operation, not application code. Repeat for other users with `customer`, `rep`, `office`, `delivery`, `accounts`, `management`, or `admin` as appropriate. Profiles must be active. Never derive roles from user-editable metadata.
6. For each customer role, create an approved `customers` row linked by `user_id`; instructions are in the provisioning script. Offline shops may have no Auth user. Insert trusted `customer_assignments` rows for reps. An approved shop and active customer profile are both required for customer access.
7. Optionally, on a **development** project only, run `supabase/seed.sql` in its SQL Editor. It adds fictional shops and five product variants, no Auth users or permissions. Link the demo shops to separately provisioned customer users and assign reps using the trusted examples. Place demo orders through the portal to exercise the real transaction flow.
8. Restart `npm.cmd run dev`, sign in with an active approved account and visit `/workspace`. Verify catalogue browsing, an order, office-issued invoice, payment, delivery assignment and collections report using separate role accounts. Follow [connection acceptance checks](docs/verification.md). The private Storage bucket and policies are created by migration 1; no public bucket setup is needed.

Guest enquiries remain disabled. Only after business approval, change the single trusted `app_settings.guest_enquiries` value (see [business decisions](docs/business-decisions.md)). The public form and database RPC use that same setting.

## Local database verification

For a full demo account/shop/product setup, follow [demo-setup.md](docs/demo-setup.md). Its two scripts live under `supabase/demo/` and are run manually in the chosen demo project, never automatically during migration. The local PostgreSQL verifier also checks that this pack can be run twice and that buyer/representative/delivery permissions stay separate.

With Docker Desktop running and the Supabase CLI installed:

```powershell
supabase start
supabase db reset --local --no-seed
npm.cmd run test:db
```

The SQL suite uses `psql`, defaults to the local Supabase database at 127.0.0.1:54322, and rolls back its fixtures. Its runner rejects non-local database URLs. It does not create application environment credentials or connect to remote projects. Optional local seed: run `supabase/seed.sql` using your local SQL client after choosing to load it.

If Docker is unavailable and PostgreSQL server binaries are installed, the isolated alternative is:

```powershell
powershell -NoProfile -File scripts/verify-sql.ps1
```

See [verification instructions](docs/verification.md) for a process-only execution-policy override, binary location and port options. This tests the actual migrations, seed, transaction functions and RLS with minimal auth/storage test schemas; it is not full Supabase service integration.

## Main folders

- `src/app/(public)`: entry, sign-in, setup and development preview.
- `src/app/(customer)`: catalogue, product details, order creation/history, digital invoices and enquiries.
- `src/app/(staff)`: workspace, billing/payments, delivery queue, collections and reports.
- `src/features`: feature-owned UI, validation, server queries/actions and domain rules.
- `src/components/ui`, `src/lib`, `src/types`: shared presentation, configuration/clients and explicit domain types.
- `supabase/migrations`, `supabase/seed.sql`, `supabase/tests`: backend schema/policies, optional demo data and SQL assertions.
- `docs`: architecture, pending business decisions and reproducible connected verification.

Read [architecture and limits](docs/architecture.md) for the authorization matrix, transaction design, image policies and accounting semantics. Read [open business decisions](docs/business-decisions.md) before enabling guest intake or adopting tax, credit, cheque, warranty, profit, stock or native-app policies.

## Source and verification status

The implementation PDF remains unavailable; written requirements were used. The supplied JPEG logo has now been converted to a transparent PNG at `public/census-logo.png` and applied throughout the shared branding. No PDF page, including the final decisions page, was available to inspect.

Verification results from this implementation are recorded in `docs/handoff.md`. A real Supabase project is still required to verify email/password login, SSR cookie refresh, PostgREST relationships, Storage uploads/signed URLs and full multi-account browser flows. No remote project has been modified.
