import { expect, test, type Page } from "@playwright/test";
const uid = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000002";
const variantId = "00000000-0000-4000-8000-000000000003";
const productId = "00000000-0000-4000-8000-000000000004";
const orderId = "00000000-0000-4000-8000-000000000005";
const invoiceId = "00000000-0000-4000-8000-000000000006";
const lineId = "00000000-0000-4000-8000-000000000007";
type Call = { name: string; params: Record<string, unknown> };
async function mock(
  page: Page,
  role: string,
  approved = true,
  failOrder = false,
) {
  const calls: Call[] = [];
  const payload = Buffer.from(
    JSON.stringify({
      sub: uid,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.test`;
  await page.route(
    "https://census-mobile-test.supabase.co/**",
    async (route) => {
      const url = new URL(route.request().url());
      const name = url.pathname.split("/").pop()!;
      let json: unknown = [];
      if (url.pathname.includes("/auth/")) {
        const user = {
          id: uid,
          email: "test@example.com",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        };
        json =
          name === "user"
            ? user
            : {
                access_token: token,
                refresh_token: "mock-refresh",
                expires_in: 3600,
                token_type: "bearer",
                user,
              };
      } else if (url.pathname.includes("/rpc/")) {
        const params = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        calls.push({ name, params });
        if (name === "allow_sign_in") json = true;
        else if (name === "catalogue_page")
          json = {
            total: 1,
            page_size: 24,
            categories: ["Taps"],
            brands: ["Census"],
            products: [
              {
                id: productId,
                name: "Demo basin mixer",
                category: "Taps",
                brand: "Census",
                description: "Chrome mixer",
                active: true,
                product_images: [],
                variants: [
                  {
                    id: variantId,
                    sku: "DEMO-001",
                    label: "Chrome",
                    price_minor: 125000,
                    attributes: {},
                    active: true,
                    product_id: productId,
                  },
                ],
              },
            ],
          };
        else if (name === "submit_order") {
          if (failOrder && calls.filter((c) => c.name === name).length === 1) {
            await route.fulfill({
              status: 503,
              json: {
                message: "Temporary connection interruption. Try again.",
                code: "TEST",
              },
            });
            return;
          }
          json = orderId;
        } else json = invoiceId;
      } else if (name === "profiles")
        json = url.searchParams.has("role")
          ? [
              {
                id: uid,
                full_name: "Demo Staff",
                role: url.searchParams.get("role")?.replace("eq.", ""),
                active: true,
              },
            ]
          : { id: uid, full_name: "Demo Person", role, active: true };
      else if (name === "customers")
        json = url.searchParams.has("user_id")
          ? approved
            ? { id: customerId }
            : null
          : [{ id: customerId, shop_name: "Demo Hardware", approved: true }];
      else if (name === "invoices")
        json = [
          {
            id: invoiceId,
            reference: "INV-DEMO",
            order_id: orderId,
            customer_id: customerId,
            customers: { shop_name: "Demo Hardware" },
            issued_at: new Date().toISOString(),
            state: "issued",
            total_minor: 125000,
            invoice_lines: [
              {
                id: lineId,
                description: "Demo basin mixer",
                quantity: 1,
                unit_price_minor: 125000,
              },
            ],
            payments: [],
          },
        ];
      else if (name === "deliveries")
        json = [
          {
            id: orderId,
            order_id: orderId,
            customer_id: customerId,
            assigned_to: uid,
            shop_name: "Demo Hardware",
            address: "12 Demo Road",
            status: "assigned",
            collection_occurred: false,
            items: [
              {
                order_line_id: lineId,
                sku: "DEMO-001",
                description: "Demo basin mixer",
                ordered: 2,
                fulfilled: 0,
              },
            ],
          },
        ];
      await route.fulfill({ json });
    },
  );
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return calls;
}
test("buyer submits an order; failed retries keep the same key; sign-out clears private data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = await mock(page, "customer", true, true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Catalogue", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to order" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /New order/ })
    .click();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary connection");
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Order submitted successfully",
  );
  const orders = calls.filter((c) => c.name === "submit_order");
  expect(orders).toHaveLength(2);
  expect(orders[0].params.p_key).toBe(orders[1].params.p_key);
  expect(orders[1].params.p_lines).toEqual([
    { variant_id: variantId, quantity: 1 },
  ]);
  expect(orders[1].params).not.toHaveProperty("p_price_minor");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes("auth-token")),
    ),
  ).toEqual([]);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Collections" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/mobile/buyer-order.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("unapproved buyer is denied", async ({ page }) => {
  await mock(page, "customer", false);
  await expect(page.getByRole("alert")).toContainText(
    "awaiting office approval",
  );
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("driver updates assigned quantities and cannot open billing", async ({
  page,
}) => {
  const calls = await mock(page, "delivery");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Deliveries", exact: true })
    .click();
  await page.getByLabel(/Demo basin mixer/).fill("1");
  await page.getByLabel("Delivery status").selectOption("partial");
  await page.getByRole("button", { name: "Save delivery update" }).click();
  await expect
    .poll(() => calls.find((c) => c.name === "update_delivery"))
    .toBeTruthy();
  expect(
    calls.find((c) => c.name === "update_delivery")?.params.p_items,
  ).toEqual([{ order_line_id: lineId, fulfilled: 1 }]);
  await page.goto("/#invoices");
  await expect(
    page.getByRole("heading", { name: "Access unavailable" }),
  ).toBeVisible();
  expect(calls.filter((c) => c.name === "record_payment")).toHaveLength(0);
});
test("accounts records exact payment amount and goes offline safely", async ({
  page,
  context,
}) => {
  const calls = await mock(page, "accounts");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Invoices", exact: true })
    .click();
  await page.getByText("Record a payment", { exact: true }).click();
  await page.getByLabel("Amount (LKR)", { exact: true }).fill("500.25");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect
    .poll(() => calls.find((c) => c.name === "record_payment"))
    .toBeTruthy();
  expect(
    calls.find((c) => c.name === "record_payment")?.params.p_amount_minor,
  ).toBe(50025);
  await context.setOffline(true);
  await expect(page.getByText(/You are offline/)).toBeVisible();
  await context.setOffline(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("phone and tablet layouts keep navigation visible and all sections reachable", async ({
  page,
}) => {
  await mock(page, "admin");
  await expect(
    page.getByRole("heading", { name: /Hello, Demo/ }),
  ).toBeVisible();
  for (const width of [320, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    const box = await navigation.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/mobile/redesign-home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "More sections" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: "Sales reports", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/mobile/redesign-menu-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "More sections" }),
    ).toBeFocused();
  }
  await page.getByRole("button", { name: "More sections" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Enquiries", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Enquiries", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByText("Send an enquiry", { exact: true }).click();
  await page.setViewportSize({ width: 320, height: 480 });
  await page
    .getByLabel("Notes", { exact: true })
    .fill("A test with a keyboard-sized viewport.");
  const submit = page.getByRole("button", {
    name: "Send enquiry",
    exact: true,
  });
  await submit.scrollIntoViewIfNeeded();
  const submitBox = await submit.boundingBox();
  const navBox = await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .boundingBox();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("sign-in scales to small phones and password visibility is accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".login-welcome svg")).toHaveCount(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/mobile/redesign-login-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});

test("mobile form actions have consistent spacing and fit narrow cards", async ({
  page,
}) => {
  await mock(page, "admin");
  const checkButtons = async () => {
    const problems = await page
      .locator(
        "main .form-actions > button, main .card > button, main .filters > button, main .row > button",
      )
      .evaluateAll((buttons) =>
        buttons.flatMap((button) => {
          const rect = button.getBoundingClientRect();
          if (!rect.width || !rect.height) return [];
          const parent = button.parentElement!.getBoundingClientRect();
          const style = getComputedStyle(button);
          return rect.height < 44 ||
            rect.left < parent.left - 1 ||
            rect.right > parent.right + 1 ||
            button.scrollWidth > button.clientWidth + 1 ||
            Number.parseFloat(style.paddingLeft) < 10 ||
            Number.parseFloat(style.paddingRight) < 10
            ? [button.textContent]
            : [];
        }),
      );
    expect(problems).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  };
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Catalogue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to order" }),
  ).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await checkButtons();
    const quantity = await page
      .getByLabel("Quantity", { exact: true })
      .boundingBox();
    const add = await page
      .getByRole("button", { name: "Add to order" })
      .boundingBox();
    expect(
      Math.abs(quantity!.y + quantity!.height - add!.y - add!.height),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/mobile/button-catalogue-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Edit product / upload image" })
    .click();
  await page.setViewportSize({ width: 320, height: 844 });
  await checkButtons();
  await page.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Add to order" }).click();
  for (const [screen, heading] of [
    ["cart", "Review your order"],
    ["invoices", "Invoices & payments"],
    ["deliveries", "Delivery queue"],
    ["enquiries", "Enquiries"],
  ]) {
    await page.evaluate((id) => {
      location.hash = id;
    }, screen);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (screen === "invoices") {
      await expect(
        page.getByRole("button", { name: "Share invoice summary" }),
      ).toBeVisible();
      await page.getByText("Record a payment", { exact: true }).click();
    }
    if (screen === "deliveries")
      await expect(
        page.getByRole("button", { name: "Save delivery update" }),
      ).toBeVisible();
    if (screen === "enquiries")
      await page.getByText("Send an enquiry", { exact: true }).click();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await checkButtons();
      await page.screenshot({
        path: `test-results/mobile/button-${screen}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
