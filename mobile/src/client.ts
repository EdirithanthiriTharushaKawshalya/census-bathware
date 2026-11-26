import { createClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/domain";

export const db = __SUPABASE_CONFIG__
  ? createClient(__SUPABASE_CONFIG__.url, __SUPABASE_CONFIG__.key, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: true,
      },
    })
  : null;

export function database() {
  if (!db)
    throw new Error(
      "Supabase is not configured. Rebuild the app with the public project settings.",
    );
  return db;
}
export function check<
  R extends { data: unknown; error: { message: string } | null },
>(result: R): R["data"] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function rpc<T = unknown>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return check(await database().rpc(name, params)) as T;
}
export async function actor(): Promise<Profile> {
  const client = database();
  const user = check(await client.auth.getUser()).user;
  if (!user) throw new Error("Please sign in again.");
  const profile = check(
    await client
      .from("profiles")
      .select("id,full_name,role,active")
      .eq("id", user.id)
      .single(),
  ) as Profile;
  if (!profile?.active)
    throw new Error("Your account is inactive. Contact the office.");
  if (profile.role === "customer") {
    const customer = check(
      await client
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .eq("approved", true)
        .maybeSingle(),
    );
    if (!customer)
      throw new Error("Your buyer account is awaiting office approval.");
  }
  return profile;
}
