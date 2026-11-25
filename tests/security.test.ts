import assert from "node:assert/strict";
import { test } from "node:test";
import { supabaseConfig } from "../src/lib/env/public";
import { catalogueStorageWriter } from "../src/lib/supabase/storage-writer";
import { sessionCookieOptions } from "../src/lib/supabase/cookie-options";
import {
  securityHeaders,
  privateCacheHeaders,
} from "../src/lib/security/headers";
test("public configuration rejects secret keys, credential URLs and remote HTTP", () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_fixture";
    assert.equal(supabaseConfig(), null);
    const encoded = Buffer.from(
      JSON.stringify({ role: "service_role" }),
    ).toString("base64");
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = `header.${encoded}.signature`;
    assert.equal(supabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
    for (const url of [
      "http://remote.example",
      "https://user:password@fixture.supabase.co",
      "https://fixture.supabase.co/rest/v1/",
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      assert.equal(supabaseConfig(), null);
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    assert.equal(supabaseConfig()?.url, "http://127.0.0.1:54321");
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
  }
});
test("production response policy blocks framing and prevents private CDN caching", () => {
  const headers = new Map(
    securityHeaders(true, "https://fixture.supabase.co").map((h) => [
      h.key,
      h.value,
    ]),
  );
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.ok(
    headers.get("Content-Security-Policy")?.includes("frame-ancestors 'none'"),
  );
  assert.ok(!headers.get("Content-Security-Policy")?.includes("unsafe-eval"));
  assert.equal(
    privateCacheHeaders.find((h) => h.key === "CDN-Cache-Control")?.value,
    "no-store",
  );
});
test("storage writer fails closed without a server-only secret", () => {
  const previous = process.env.SUPABASE_SECRET_KEY;
  try {
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal(catalogueStorageWriter(), null);
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_not_a_secret";
    assert.equal(catalogueStorageWriter(), null);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous;
  }
});
test("production session cookies require HTTPS and use same-site protection", () => {
  assert.equal(sessionCookieOptions(true).secure, true);
  assert.equal(sessionCookieOptions(true).sameSite, "lax");
  assert.equal(sessionCookieOptions(false).secure, false);
});
