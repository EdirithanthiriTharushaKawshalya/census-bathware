import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/env/public";

/** Only the sanitized upload action calls this, after verified staff authorization. */
export function catalogueStorageWriter() {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret?.startsWith("sb_secret_")) return null;
  return createClient(config.url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).storage.from("catalogue");
}
