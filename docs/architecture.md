# Implementation notes

Next.js 16.4.6, App Router, strict TypeScript, Tailwind 4, React 19 and npm reuse the scaffold. The installed Next documentation was read before implementation. `src/proxy.ts` refreshes Supabase sessions with the current Proxy convention, while the feature data layer independently verifies the user, active trusted profile and customer approval. The scaffold's optional Cache Components / partial-prefetch flags were removed so authenticated routes use ordinary request-time cookie rendering. No network font dependency is required for builds.

- `src/app/(public)` contains the entry, sign-in, setup, and development-only read-only demo. `/demo` returns 404 in production, regardless of credentials. It has no write actions and never authenticates into the real workspace.
- `src/app/(customer)` contains thin catalogue, order, invoice and enquiry routes. Route groups do not imply authorization: feature queries/actions check their own permissions.
- `src/app/(staff)` contains the role-aware workspace, billing, delivery, collections and reporting routes.
- `src/features` owns each feature's UI, queries, actions, input validation and accounting rules. `components/ui` contains genuinely shared presentation and action-state components.
- `src/lib/supabase` contains SSR/browser clients and safe result handling. Login and business reads use the public URL/publishable key. The sanitized catalogue upload path additionally uses a separate, server-only Storage secret; ordinary staff JWTs cannot write objects directly.
- `supabase/migrations` defines the schema, RLS, private storage, constrained transactional RPCs, reporting and invoice corrections. `seed.sql` is optional development data, separate from migrations.

## Trust boundaries

`profiles.role` is authoritative, never user metadata. No application role has table write privileges on business records or profiles. All writes use constrained `SECURITY DEFINER` RPCs with empty search paths, explicit object qualification, checked roles and ownership/assignment. Functions have explicit execution grants. Profile, customer, assignment and business-setting provisioning is a trusted administrative process outside the browser. No trigger grants privileges at signup.

RLS prevents anonymous catalogue/price reads; unapproved customers cannot read prices or orders; approved customers see their own account's records; representatives see assigned customers; office/accounts/management/admin can see the records required for their role. Delivery staff see only their own assigned dispatch records and no order prices. Management/admin can read audit records. All roles and assignments are checked on every request and in the database, so revocation does not wait for JWT metadata expiry.

Catalogue objects live in the private `catalogue` bucket. Authorized users receive five-minute signed URLs, batched and briefly reused after actor authorization. New inputs are limited to 8 MB and 20 megapixels, decoded/stripped/resized by Sharp, and stored as immutable WebP variants with a 2 MB per-object cap. Only the server-only writer can upload; legacy objects stay readable. Cached signed-image responses can outlive token expiry, so image access is not instantly revoked. Prices and customer records are never shared through this cache. See [security and CDN details](security-performance.md).

## Accounting and transactions

Money uses integer LKR minor units with database bounds below JavaScript's exact integer ceiling for individual documents. The server converts decimal payment/price strings without floating-point multiplication. Database sums and transaction arithmetic are exact PostgreSQL integer/numeric operations. Reports return monetary aggregates as decimal strings and format them with BigInt, preserving cents beyond the JavaScript safe integer range. Only chart proportions use approximate numbers.

Order submission resolves active variants and prices in the database and snapshots SKU, description and unit price. A retried actor/key pair returns the existing order; repeated variant IDs are rejected. Advisory transaction locks serialize actor/key retries. An order is never an enquiry, invoice or payment.

Invoice issuance locks the order, enforces one invoice per order and copies its original lines; catalogue edits cannot change the invoice. Explicit invoice voiding preserves those lines and audits the reason. Payment recording locks the invoice and prevents allocations above the remaining unallocated amount, including reservations for pending cheques. Actor/key uniqueness plus transaction locks prevent concurrent duplicates. Pending/bounced/void payments do not count as collected money. Payment corrections lock the same invoice, retain the original amount/method, and add an audit event. Amount corrections require voiding and recording a fresh payment with a new key. Concurrent invoice voiding/payment entry serializes on the invoice lock.

Delivery records expose only safe shop/address/SKU/quantity snapshots to delivery staff. Updates validate every line against the assigned dispatch and preserve events. Fulfilled quantities are cumulative, not increments. The collection checkbox never creates a payment. Actual fulfilled value uses order snapshot unit prices, independently of invoice/payment state.

Reports aggregate in SQL over all permitted records, separately by order date and invoice issue date. Invoice voids are excluded from sales and balances. Monthly and representative totals exclude enquiries. Collection totals use current eligible payment states and payment dates; they are not an immutable historical bank statement. Profit remains hidden until an approved cost model is configured.

## Limits requiring operational follow-up

The standalone PostgreSQL suite verifies real migrations, SQL transactions and RLS using minimal test implementations of Supabase's auth/storage schemas. It cannot verify Auth login, SSR cookie refresh, PostgREST relationship inference, object uploads or deployed service integration. Connected Supabase acceptance checks remain required. The catalogue is paginated at 24 products; other list screens cap parent results at 500 and nested PostgREST arrays are subject to its configured row cap; database reports are not based on these capped lists. Pagination and accounting-document export should be expanded if that scale is expected. There are no online payments, email automation, inventory movements or credit formulas.
