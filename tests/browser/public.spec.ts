import { test, expect } from "@playwright/test";
test("public entry renders at desktop and mobile without credentials", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  await expect(page.getByRole("heading", { name: /Good days/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Partner sign in" }),
  ).toBeVisible();
  const logo = page
    .getByRole("img", { name: "Census Bathware", exact: true })
    .first();
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Send enquiry" })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "test-results/public-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: /Good days/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/public-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("protected customer and staff routes show setup instead of granting access", async ({
  page,
}) => {
  for (const path of [
    "/catalogue",
    "/orders/new",
    "/enquiries",
    "/workspace/billing",
    "/workspace/deliveries",
    "/workspace/collections",
    "/workspace/reporting",
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["cdn-cache-control"]).toBe("no-store");
    await page.goto(path);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole("heading", { name: "Connect your workspace" }),
    ).toBeVisible();
  }
});
test("sign-in explains missing connection and cannot pretend to authenticate", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(
    page.getByText("Connection pending", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("demo@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "awaiting its Supabase connection" }),
  ).toContainText("awaiting its Supabase connection");
  await expect(page).toHaveURL(/\/sign-in$/);
});
test("demo is read-only in development and unavailable in production", async ({
  page,
}) => {
  const response = await page.goto("/demo");
  if (process.env.CENSUS_BROWSER_PRODUCTION === "1") {
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "A little off track." }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText("Development-only preview · Fictional data · Read only"),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
  }
});
