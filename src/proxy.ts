import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/env/public";
import { privateCacheHeaders } from "@/lib/security/headers";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

export async function proxy(request: NextRequest) {
  // Reject before streaming begins so production previews have a real HTTP 404.
  if (
    request.nextUrl.pathname === "/demo" &&
    process.env.NODE_ENV !== "development"
  ) {
    return new NextResponse(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Census Bathware</title><link rel="icon" href="/census-mark.svg"></head><body style="margin:0;background:#fbfcfa;color:#183f39;font:16px/1.65 Arial,sans-serif"><main style="max-width:800px;margin:15vh auto;padding:24px"><p>CENSUS BATHWARE / 404</p><h1 style="font:48px Georgia,serif">A little off track.</h1><p>We couldn’t find that page.</p><a href="/" style="color:inherit">Back to Census</a></main></body></html>',
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
  const config = supabaseConfig();
  if (!config) {
    const response = NextResponse.next();
    privateCacheHeaders.forEach((header) =>
      response.headers.set(header.key, header.value),
    );
    return response;
  }
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Verify/refresh locally where possible; the data layer still calls getUser()
  // and checks active profile/approval before any business data is returned.
  await client.auth.getClaims();
  privateCacheHeaders.forEach((header) =>
    response.headers.set(header.key, header.value),
  );
  return response;
}
export const config = {
  matcher: [
    "/demo",
    "/workspace/:path*",
    "/catalogue/:path*",
    "/orders/:path*",
    "/enquiries/:path*",
    "/sign-in",
  ],
};
