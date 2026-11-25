"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { mutationResult } from "@/lib/supabase/result";
import { orderInput, uniqueVariants } from "./validation";
import type { ActionState } from "@/types/domain";
export async function submitOrder(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("orders");
  let lines: unknown;
  try {
    lines = JSON.parse(String(form.get("lines")));
  } catch {
    return { ok: false, message: "Choose at least one product variant." };
  }
  const parsed = orderInput.safeParse({ ...Object.fromEntries(form), lines });
  if (!parsed.success || !uniqueVariants(parsed.data.lines))
    return {
      ok: false,
      message:
        "Choose a customer and unique variants with positive whole quantities.",
    };
  const p = parsed.data;
  const client = await serverClient();
  const { data, error } = await client.rpc("submit_order", {
    p_customer_id: p.customer_id,
    p_rep_id: p.rep_id || null,
    p_terms: p.terms,
    p_notes: p.notes,
    p_lines: p.lines,
    p_key: p.key,
  });
  if (!error) revalidatePath("/orders");
  if (error) return mutationResult(error, "");
  const { data: order } = await client
    .from("orders")
    .select("reference")
    .eq("id", data)
    .single();
  return {
    ok: true,
    message: "Order received. Your confirmation is available in order history.",
    reference: order?.reference || String(data),
  };
}
