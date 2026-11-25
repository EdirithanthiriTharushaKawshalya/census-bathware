import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env/public";
import { requireSession } from "@/features/auth/session";
import { queryResult } from "@/lib/supabase/result";
import type { Enquiry } from "@/types/domain";
export async function guestEnquiriesEnabled() {
  if (!supabaseConfig()) return false;
  const config = supabaseConfig()!;
  // This single public boolean does not depend on a visitor's cookies/session.
  // A short public-data cache keeps the landing page off the authentication path.
  try {
    const response = await fetch(
      `${config.url}/rest/v1/app_settings?select=guest_enquiries&singleton=eq.true`,
      {
        headers: { apikey: config.key },
        next: { revalidate: 30, tags: ["public-settings"] },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return (
      Array.isArray(data) &&
      data.length === 1 &&
      data[0]?.guest_enquiries === true
    );
  } catch {
    return false;
  }
}
export async function enquiries() {
  await requireSession("enquiries");
  const client = await serverClient();
  const { data, error } = await client
    .from("enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return queryResult<Enquiry[]>(data, error);
}
