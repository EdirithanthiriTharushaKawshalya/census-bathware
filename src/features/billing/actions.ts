"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { mutationResult } from "@/lib/supabase/result";
import { parseMoney } from "./money";
import type { ActionState } from "@/types/domain";
function refresh() {
  revalidatePath("/workspace");
  revalidatePath("/orders");
}
export async function issueInvoice(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("billing");
  const parsed = z
    .object({ order_id: z.uuid(), key: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Select a valid order." };
  const client = await serverClient();
  const { data, error } = await client.rpc("issue_invoice", {
    p_order_id: parsed.data.order_id,
    p_key: parsed.data.key,
  });
  if (!error) refresh();
  return mutationResult(
    error,
    "Invoice issued. The quantities and unit prices have been permanently snapshotted.",
    data ? String(data) : undefined,
  );
}
export async function recordPayment(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("billing");
  const parsed = z
    .object({
      invoice_id: z.uuid(),
      key: z.uuid(),
      amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
      method: z.enum(["cash", "bank", "cheque"]),
      paid_on: z.iso.date(),
      cheque_number: z.string().max(80),
      bank: z.string().max(150),
      cheque_date: z.union([z.iso.date(), z.literal("")]),
      note: z.string().max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the payment amount, method, date, and cheque details.",
    };
  const p = parsed.data;
  if (
    p.method === "cheque" &&
    (!p.cheque_number.trim() || !p.bank.trim() || !p.cheque_date)
  )
    return {
      ok: false,
      message:
        "Cheque number, bank, and cheque date are required for a cheque.",
    };
  const client = await serverClient();
  const { error } = await client.rpc("record_payment", {
    p_invoice_id: p.invoice_id,
    p_amount_minor: parseMoney(p.amount),
    p_method: p.method,
    p_paid_on: p.paid_on,
    p_cheque_number: p.cheque_number || null,
    p_bank: p.bank || null,
    p_cheque_date: p.cheque_date || null,
    p_note: p.note,
    p_key: p.key,
  });
  if (!error) refresh();
  return mutationResult(
    error,
    p.method === "cheque"
      ? "Cheque recorded as pending. It reduces the balance only after clearance."
      : "Payment recorded and balance updated.",
  );
}
export async function correctPayment(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("billing");
  const parsed = z
    .object({
      id: z.uuid(),
      state: z.enum(["cleared", "bounced", "void"]),
      reason: z.string().trim().min(5).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Choose a correction and provide a reason of at least five characters.",
    };
  const client = await serverClient();
  const { error } = await client.rpc("correct_payment", {
    p_id: parsed.data.id,
    p_state: parsed.data.state,
    p_reason: parsed.data.reason,
  });
  if (!error) refresh();
  return mutationResult(
    error,
    "Payment state updated. The previous record and reason are retained in the audit history.",
  );
}
export async function voidInvoice(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("billing");
  const parsed = z
    .object({ id: z.uuid(), reason: z.string().trim().min(5).max(2000) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: "Provide an invoice and correction reason." };
  const client = await serverClient();
  const { error } = await client.rpc("void_invoice", {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });
  if (!error) refresh();
  return mutationResult(
    error,
    "Invoice voided with audit history. For replacement billing, submit a corrected order and issue its invoice.",
  );
}
