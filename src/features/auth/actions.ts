"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env/public";
import type { ActionState } from "@/types/domain";
export async function signIn(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!supabaseConfig())
    return {
      ok: false,
      message:
        "The trade portal is awaiting its Supabase connection. See setup instructions.",
    };
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(128) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Enter a valid email address and password." };
  const client = await serverClient();
  const { data: allowed, error: limitError } = await client.rpc(
    "allow_sign_in",
    { p_email: parsed.data.email },
  );
  if (limitError)
    return {
      ok: false,
      message:
        "Sign-in protection is unavailable. Check the security migration and connection.",
    };
  if (!allowed)
    return {
      ok: false,
      message: "Too many sign-in attempts. Please wait a minute and try again.",
    };
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error)
    return {
      ok: false,
      message:
        "Unable to sign in. Check your credentials or contact the office.",
    };
  redirect("/workspace");
}
export async function signOut() {
  const client = await serverClient();
  await client.auth.signOut();
  redirect("/");
}
