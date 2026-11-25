"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { mutationResult } from "@/lib/supabase/result";
import type { ActionState } from "@/types/domain";
export async function assignDelivery(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireSession("deliveries");
  if (actor.role === "delivery")
    return { ok: false, message: "Only office staff can assign deliveries." };
  const parsed = z
    .object({ order_id: z.uuid(), assigned_to: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Choose an order and delivery staff member." };
  const client = await serverClient();
  const { error } = await client.rpc("assign_delivery", {
    p_order_id: parsed.data.order_id,
    p_assigned_to: parsed.data.assigned_to,
  });
  if (!error) revalidatePath("/workspace/deliveries");
  return mutationResult(error, "Delivery assignment saved.");
}
export async function updateDelivery(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("deliveries");
  const parsed = z
    .object({
      id: z.uuid(),
      key: z.uuid(),
      status: z.enum(["out_for_delivery", "partial", "delivered", "failed"]),
      notes: z.string().max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Check the delivery fields." };
  const items = Array.from(form.entries())
    .filter(([name]) => name.startsWith("fulfilled:"))
    .map(([name, value]) => ({
      order_line_id: name.slice(10),
      fulfilled: Number(value),
    }));
  if (
    !items.length ||
    !items.every(
      (i) =>
        z.uuid().safeParse(i.order_line_id).success &&
        Number.isInteger(i.fulfilled) &&
        i.fulfilled >= 0,
    )
  )
    return {
      ok: false,
      message: "Enter a whole fulfilled quantity for each line.",
    };
  const client = await serverClient();
  const { error } = await client.rpc("update_delivery", {
    p_id: parsed.data.id,
    p_key: parsed.data.key,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes,
    p_collection: form.get("collection") === "on",
    p_items: items,
  });
  if (!error) {
    revalidatePath("/workspace/deliveries");
    revalidatePath("/orders");
  }
  return mutationResult(
    error,
    "Delivery update saved. Any collection still needs a separate payment record from accounts.",
  );
}
