import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseConfig } from "@/lib/env/public";
import { sessionCookieOptions } from "./cookie-options";

export const serverClient = cache(async () => {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase connection is not configured.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Proxy refreshes cookies during Server Component rendering. */
        }
      },
    },
  });
});
