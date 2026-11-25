"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/env/public";
import { sessionCookieOptions } from "./cookie-options";
export function browserClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase connection is not configured.");
  return createBrowserClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions(),
  });
}
