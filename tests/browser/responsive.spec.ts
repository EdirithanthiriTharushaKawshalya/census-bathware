import { expect, test } from "@playwright/test";

test("website entry and sign-in fit phone, tablet and desktop widths", async ({
  page,
}) => {
  for (const path of ["/", "/sign-in", "/setup"]) {
    await page.goto(path);
    for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${path} at ${width}px`,
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/website-responsive-${path === "/" ? "home" : path.slice(1)}.png`,
      fullPage: true,
    });
  }
});

test("workspace layout fixture keeps long names and tables inside mobile containers", async ({
  page,
}) => {
  await page.goto("/");
  // Reuse the real compiled website stylesheet without impersonating a signed-in user.
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  await page.setContent(
    `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><div class="workspace"><aside class="sidebar"><a class="brand"><img class="brand-logo" src="/census-logo.png" alt="Census Bathware"></a><span class="eyebrow">Partner workspace</span><nav aria-label="Workspace"><a>Overview</a><a>Catalogue</a><a>Orders</a><a>Invoices & payments</a><a>Deliveries</a><a>Reports</a></nav><div class="sidebar-user"><span class="avatar">A</span><div><strong>Alexandria A Very Long Customer Account Name</strong><span>management</span></div></div><form><button class="text-link">Sign out</button></form></aside><div class="workspace-content"><header class="workspace-header"><span>CENSUS / TRADE PORTAL</span><span class="badge">management</span></header><main class="workspace-main"><div class="page-title"><h1>Orders & deliveries</h1></div><div class="panel"><h3>Recent orders</h3><div class="table-scroll"><table><thead><tr><th>Reference</th><th>Customer</th><th>Total</th></tr></thead><tbody><tr><td>ORD-DEMONSTRATION-123456789</td><td>A Very Long Shop Name For Mobile Testing</td><td>LKR 12,345,678.90</td></tr></tbody></table></div></div></main></div></div></body></html>`,
  );
  for (const width of [320, 390, 760, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `workspace fixture at ${width}px`,
    ).toBe(true);
    const brand = await page.locator(".brand").boundingBox();
    const signOut = await page
      .getByRole("button", { name: "Sign out" })
      .boundingBox();
    const name = await page.locator(".sidebar-user").boundingBox();
    expect(
      brand!.x + brand!.width <= signOut!.x ||
        brand!.y + brand!.height <= signOut!.y ||
        signOut!.y + signOut!.height <= brand!.y,
    ).toBe(true);
    expect(
      name!.x + name!.width <= signOut!.x ||
        name!.y + name!.height <= signOut!.y ||
        signOut!.y + signOut!.height <= name!.y,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/website-workspace-mobile-fixture.png",
    fullPage: true,
  });
});
