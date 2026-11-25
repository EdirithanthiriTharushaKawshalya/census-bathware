"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env/public";
import { requireSession } from "@/features/auth/session";
import { mutationResult } from "@/lib/supabase/result";
import type { ActionState } from "@/types/domain";
export async function submitEnquiry(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!supabaseConfig())
    return {
      ok: false,
      message: "Enquiries are unavailable until the portal is connected.",
    };
  const parsed = z
    .object({
      contact_name: z.string().trim().min(2).max(150),
      email: z.email().max(254),
      phone: z.string().trim().min(5).max(40),
      request: z.string().trim().min(3).max(2000),
      quantity: z.union([
        z.literal(""),
        z.coerce.number().int().min(1).max(100000),
      ]),
      notes: z.string().max(4000),
      key: z.uuid(),
      website: z.literal(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message: "Check your contact details, request, and quantity.",
    };
  const client = await serverClient();
  const p = parsed.data;
  const { data, error } = await client.rpc("submit_enquiry", {
    p_contact_name: p.contact_name,
    p_email: p.email,
    p_phone: p.phone,
    p_request: p.request,
    p_quantity: p.quantity || null,
    p_notes: p.notes,
    p_key: p.key,
  });
  if (!error) revalidatePath("/enquiries");
  return mutationResult(
    error,
    "Enquiry received. Our team will follow up with you.",
    data ? String(data) : undefined,
  );
}
export async function followUp(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireSession("enquiries");
  if (actor.role === "customer") return { ok: false, message: "Access denied" };
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["new", "following_up", "closed"]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Choose a valid enquiry status." };
  const client = await serverClient();
  const { error } = await client.rpc("update_enquiry", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (!error) revalidatePath("/enquiries");
  return mutationResult(error, "Follow-up status saved.");
}
