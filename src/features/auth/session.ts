import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env/public";
import { can, type Capability } from "./permissions";
import type { Profile } from "@/types/domain";

export const session = cache(async () => {
  if (!supabaseConfig()) return null;
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role,active")
    .eq("id", user.id)
    .single();
  if (error || !data?.active) return null;
  if (data.role === "customer") {
    const { data: customer } = await client
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .eq("approved", true)
      .maybeSingle();
    if (!customer) return null;
  }
  return data as Profile;
});
export async function requireSession(capability?: Capability) {
  const profile = await session();
  if (!profile)
    redirect(supabaseConfig() ? "/sign-in?notice=approval" : "/setup");
  if (capability && !can(profile.role, capability))
    redirect("/workspace?notice=denied");
  return profile;
}
