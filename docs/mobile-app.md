# Census Bathware mobile app

The website and mobile app share the existing Supabase project, accounts, customers, assignments, products, orders, invoices, payments and audit history. No second database or new migration is needed for this change. Saved changes are shared between both apps. Use demo accounts and records while reviewing the product.

Capacitor packages the mobile interface inside an Android or iPhone application. The interface is bundled with the installation, rather than loading a remote website through `server.url`. The Next.js website stays server-rendered: static export would break its authentication, server actions and image processing.

## Implemented workflows

The mobile interface now uses a fixed bottom navigation bar, with role-specific frequent tasks and a **More** sheet for the remaining sections. The home screen provides quick actions and a workspace list. Sign-in includes a show/hide password control. Phone layouts use full-width actions, compact product quantity controls, loading placeholders and safe-area padding; tablet layouts expand without stretching the interface across the entire screen. The website keeps its desktop design, with mobile-only fixes for the sidebar, forms, headings and table scrolling.

| User             | Mobile workflow                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved buyer   | Same login; protected product search/filtering, variants, private images, cart, order review/submission, own history and invoices, enquiries.                               |
| Representative   | Assigned customers/orders, order entry, ordered/fulfilled values, delivery progress, enquiries and permitted sales reports.                                                 |
| Office           | Customer orders with rep attribution, catalogue variants/archiving, invoices, payments/corrections, delivery assignment and enquiry follow-up.                              |
| Delivery         | Assigned queue, address, cumulative fulfilled quantities, shortages, status and collection confirmation; no payment recording or trade prices.                              |
| Accounts         | Explicit invoice issue, manual payments, cheque details/clearance/corrections, voiding, customer balances and collections.                                                  |
| Management/admin | The permitted operational screens and reports. Account/role provisioning remains the existing trusted Supabase process; there is no new mobile account-provisioning screen. |

Native additions: Census icons/splash screens, Android back handling, foreground session validation, network status, and invoice-summary sharing. Forms have loading/errors and duplicate-tap guards. Business writes call existing transactional RPCs with idempotency keys. Unchanged failed submissions reuse their key; changed cart contents receive a new key. Prices are resolved by the database. Invoice snapshots and payment balances retain existing rules.

## Run on Windows

Run from the repository root, not inside `mobile` or `android`:

```powershell
npm ci
npm run mobile:dev
```

Open `http://127.0.0.1:5173` for interface development. The build reads the existing `.env.local` public Supabase URL and publishable key. Missing/invalid public settings show a setup screen without granting access.

Create an Android test installation:

```powershell
npm run mobile:apk
```

This builds the UI, synchronizes both native projects, then runs Gradle `assembleDebug lintDebug`. The output is `android/app/build/outputs/apk/debug/app-debug.apk`, using a development signing certificate. Transfer it to a test phone and allow installation from the transfer app when Android prompts. Open **Census Bathware**, connect to the internet and sign in with a provisioned account.

Android Studio's bundled JDK and standard Windows SDK location are detected automatically. Custom locations:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = 'C:\path\to\Android\Sdk'
npm run mobile:apk
```

Android 7/API 24 or later and a current Android System WebView are required by this project. To install on a running emulator or USB device:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r 'android\app\build\outputs\apk\debug\app-debug.apk'
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -n 'com.censusbathware.app/.MainActivity'
```

`npm run mobile:android` synchronizes and opens Android Studio. Re-run `npm run mobile:apk` after mobile edits; rebuilding the website does not update an installed app. Run `npm run mobile:icons` after changing logo artwork.

## Mobile image uploads

Viewing private images uses the user's Supabase access. Uploads need the hosted Next.js server for validation, compression and the server-only Storage writer:

1. Deploy the updated website using the normal release process. Configure its public Supabase variables and server-only `SUPABASE_SECRET_KEY` on the host.
2. Add `MOBILE_WEB_APP_URL=https://your-actual-website-domain` to the root `.env.local`. Use the HTTPS origin only, without a path. This public URL is bundled into the app.
3. Run `npm run mobile:apk` and reinstall.
4. Sign in as office/admin, open Catalogue → **Edit product / upload image**, enter alt text and select a JPEG, PNG or WebP. The phone optionally reduces size first; the server validates the actual image, strips metadata and creates the existing WebP sizes.

`POST /api/mobile/catalogue-image` verifies the bearer token with Supabase, checks the active trusted role, rate limit and product access before using privileged Storage. Only native origins `https://localhost` and `capacitor://localhost` are accepted. There is no cookie authentication or wildcard CORS. Actual request bytes are bounded even without Content-Length. Existing storage policies/security-image migration must be present. Hosts may impose a smaller body limit; such uploads must be resized further or uploaded through the website within the host's limits.

Until the website origin is configured, ordinary mobile Supabase workflows and product editing work, and the upload section explains the missing host. It does not pretend uploads succeeded. Never put the server secret in Capacitor/public configuration.

## iPhone build

`ios/App` contains the Xcode project, Swift Package Manager plugins, assets and app identifier. Compilation, simulator testing and signing require **macOS and supported Xcode**; they cannot be completed on Windows.

On a Mac, clone/copy the repository, create `.env.local` containing only public settings and the optional website URL, and run:

```sh
npm ci
npm run mobile:ios
```

In Xcode, select the App target, your Apple development team under Signing & Capabilities, then an iPhone simulator/device and Run. Use Product → Archive → Distribute App for TestFlight after device acceptance and developer account setup. The website server secret is not needed to build the mobile app.

## Security and limits

- Sessions are memory-only. Closing the process or signing out clears session/cart. Passwords/tokens are not written to localStorage, Preferences or native source. Remembered sessions/biometric unlock would need a reviewed OS-backed secure-storage integration.
- Internet is required for business reads/writes. There is no offline financial queue or automatic background resubmission. Loaded records may stay visible while the app is open; sign out before sharing a device.
- UI uses shared role rules; Supabase independently checks trusted roles, ownership and assignment on each protected read/RPC. Menu hiding does not provide database authorization by itself.
- Only allowlisted public configuration is bundled. `node scripts/verify-mobile-bundle.mjs` scans built assets against secret-key patterns and the configured server secret without printing it. CSP restricts data/image hosts. Android cleartext traffic and backups are disabled.
- No push notifications, camera/location permissions, background location, stock movements, online payments or offline sync were added. Sharing opens a system sheet on explicit user action; check the recipient.
- Lists show up to 100 recent parent records and 500 customer/order options; catalogue search is paginated. Signed image URLs last five minutes; reopen Catalogue to refresh expired images. Profit remains unavailable until cost data/calculation are approved.

## Verification and client review

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run mobile:test
npm run mobile:build
node scripts/verify-mobile-bundle.mjs
npm run mobile:apk
```

The mobile browser suite uses a fake project URL and intercepts all project requests. It tests frontend flows without using real accounts or writing to your project. It is not live database verification. Rebuild normally before distributing an APK: the test command deliberately produces a test-configured `mobile/dist`.

On real Android and iPhone devices, verify: buyer order → office invoice → driver assignment and partial/full delivery → accounts cash/pending cheque → clearance/bounce → balances/reports in both apps. Also test representative attribution, unapproved buyer denial, another customer's privacy, another driver's assignment denial, incorrect passwords, offline/reconnect, session expiry, keyboard/safe areas, image upload, sharing and cold restart. Use demo data. Existing isolated SQL tests remain documented in README.

Store release requires confirmation of the permanent app ID (currently `com.censusbathware.app`), organization ownership, privacy policy/support URL, signing keys, developer accounts, screenshots/descriptions and reviewer access. Create a signed Android App Bundle in Android Studio for Play; keep signing credentials outside Git. The debug APK is for testing. These commands do not deploy the website, submit to stores, or apply remote migrations/seeds.

Official references: [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow), [configuration](https://capacitorjs.com/docs/config), [environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), [Android release](https://capacitorjs.com/docs/android/deploying-to-google-play), [iOS release](https://capacitorjs.com/docs/ios/deploying-to-app-store).
