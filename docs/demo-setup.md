# Demo accounts and product setup

Use only in the chosen demo project. These steps do not launch the website or create real business records. The original owner/admin account is preserved. All four migrations must be applied first, including `202611260001_security_and_images.sql`.

## 1. Create the login users

Your unique demo passwords are in the local ignored file `.tmp/demo-login-details.txt`. They are not in Git or in SQL. They are demo passwords only; do not reuse them for the real business.

In Supabase **Authentication > Users**, use **Add user > Create new user** for each email below. Set its matching password from the local file. Enable **Auto Confirm User** if shown. Do not send invitations: `example.com` addresses are reserved example addresses and do not receive verification email. Public signup stays disabled.

| Email                            | Role              |
| -------------------------------- | ----------------- |
| census.demo.admin@example.com    | Admin             |
| census.demo.manager@example.com  | Management        |
| census.demo.office@example.com   | Office            |
| census.demo.accounts@example.com | Accounts          |
| census.demo.rep.a@example.com    | Representative A  |
| census.demo.rep.b@example.com    | Representative B  |
| census.demo.driver.a@example.com | Delivery worker A |
| census.demo.driver.b@example.com | Delivery worker B |
| census.demo.buyer.a@example.com  | Buyer A           |
| census.demo.buyer.b@example.com  | Buyer B           |
| census.demo.pending@example.com  | Unapproved buyer  |

This creates the email/password identities. Their application roles and shops are added in the next step. Do not give every user the admin role.

## 2. Add roles, shops and representative assignments

Open `supabase/demo/01-accounts-and-shops.sql`, copy its entire contents into the trusted Supabase SQL Editor and run it once. It looks up Auth IDs from the exact emails above. No UUIDs or passwords need replacing.

Run the complete file in a fresh query, without selecting only a few lines. Both demo files now keep their setup data inside one atomic `DO` block and do not depend on temporary tables or earlier query sessions. If an older copy reported that `census_demo_people` does not exist, replace the old query text with the current complete file and run it again. Existing demo rows can be reused; no cleanup or password reset is required for this fix.

If a login user is missing, the script lists the missing emails and rolls back without leaving half the setup. Create the missing users in Auth and rerun this file. Rerunning does not change Auth passwords. It restores the demo profile roles, activates those demo profiles, and restores the planned shop approval states. It does not delete orders or touch the real owner/admin account.

The result is 11 profiles and 6 clearly labeled fictional shops:

- Buyer A owns `[DEMO] Perera Hardware` and is approved. Representative A is assigned to this shop, Central Tile House, and North Home Supplies.
- Buyer B owns `[DEMO] Southern Home Centre` and is approved. Representative B is assigned to this shop and Eastern Bath Gallery.
- The pending buyer owns `[DEMO] Pending Approval Shop`. Its login identity is confirmed, but the shop is unapproved. Portal access must be denied; this is intentional.
- Shops without buyer logins can be used by office staff for phone/offline order entry.
- Delivery workers A/B are selected separately when assigning deliveries in the application.

## 3. Add the demo products

Open `supabase/demo/02-products.sql`, copy the entire file into a new SQL Editor query and run it. It adds 30 fictional products and 60 variants across five categories and three clearly fictional brands. Every product name starts with `[DEMO]`; every SKU starts with `DEMO-`. Prices are fictional LKR prices, not an approved business price list. No warranty promises are inserted.

The script can be rerun without duplicating its products or overwriting prices changed in the app. The database stores prices in cents; the result table displays rupees. You do not need to calculate cents when entering products through the website.

The starter `supabase/seed.sql` is a separate smaller sample set. It is not required for this pack. Do not run the SQL files under `supabase/tests` in the remote dashboard; those are local verification fixtures.

## 4. Upload photographs through the website

Run `npm.cmd run dev` and open `http://localhost:3000/sign-in` (use the actual port shown in the terminal). Sign in with the demo admin account. Open **Catalogue**, choose a product, expand **Upload catalogue image**, select a JPEG/PNG/WebP and enter an image description. Upload an appropriate client-provided or approved sample product photograph. SQL creates product records, not photo files.

The latest security migration and a valid `SUPABASE_SECRET_KEY` in ignored `.env.local` are required for uploads. The application resizes/compresses photographs and stores private WebP versions. Do not create image rows pointing at files that have not been uploaded, and do not make the bucket public. New uploads are limited to 30 attempts/hour per authorized staff account. The demo office account can also upload photographs.

## 5. Add products manually when testing admin entry

Open **Catalogue > Add a product and its first variant**. Example:

| Field             | Demo value                                            |
| ----------------- | ----------------------------------------------------- |
| Product name      | `[DEMO] Video Test Basin`                             |
| Category          | `Basins & vanities`                                   |
| Brand             | `Census Demo Studio`                                  |
| Unique SKU        | `DEMO-VIDEO-BASIN-001`                                |
| Variant label     | `560 mm / White`                                      |
| Trade price (LKR) | `18000.00`                                            |
| Description       | `Fictional product used in the client demonstration.` |
| Warranty          | Leave blank                                           |
| Attributes        | `{"finish":"White","width":"560 mm"}`                 |
| Product active    | Checked                                               |

After creating it, open the product to add more variants or upload a picture. A SKU must be unique. Do not reuse a seeded SKU for a new product.

## 6. Verify the accounts and make a real demo order

Use separate browser profiles/private windows or sign out before switching users. Buyer A can order `DEMO-BAS-001-A` (Arc countertop basin, 560 mm/White) at Rs. 18,000 each. Ten units total Rs. 180,000. Representative A should see the order; representative B and buyer B should not.

Office can review/issue its invoice and assign delivery worker A. Delivery worker A sees the assigned stop; worker B does not. Accounts can record Rs. 50,000 cash, leaving Rs. 130,000 outstanding. Management can inspect the invoice/report. The pending buyer must be refused portal access.

Orders, invoices, payments, deliveries and monthly history are not preloaded by these two setup files. Create initial orders through the actual website to test those flows. A separate, clearly scoped historical demo pack would be needed to populate several months of reports; do not invent random invoice/payment totals.

## Before launch

Keep these demo passwords out of recordings and source control. Replace/remove demo users before production, or launch a fresh production project and retain this project for demonstrations. Do not delete profiles/Auth users blindly: orders and audit records reference their original actors. This pack does not include a destructive cleanup command.
