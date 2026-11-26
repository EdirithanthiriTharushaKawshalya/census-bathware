import { expect, test } from "@playwright/test";

test("native upload API rejects other origins and unauthenticated requests", async ({
  request,
}) => {
  const denied = await request.post("/api/mobile/catalogue-image", {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(denied.status()).toBe(403);
  expect(denied.headers()["access-control-allow-origin"]).toBeUndefined();
  for (const origin of ["https://localhost", "capacitor://localhost"]) {
    const options = await request.fetch("/api/mobile/catalogue-image", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
    expect(options.status()).toBe(204);
    expect(options.headers()["access-control-allow-origin"]).toBe(origin);
    const response = await request.post("/api/mobile/catalogue-image", {
      headers: { Origin: origin },
    });
    expect([401, 503]).toContain(response.status());
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).ok).toBe(false);
  }
});
