"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { mutationResult } from "@/lib/supabase/result";
import { parseMoney } from "@/features/billing/money";
import type { ActionState } from "@/types/domain";
import { storeCatalogueImage } from "./image-upload.server";
const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((value) => value || null);
export async function saveProduct(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("manageCatalogue");
  const parsed = z
    .object({
      product_id: optionalId,
      variant_id: optionalId,
      name: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(100),
      brand: z.string().trim().min(1).max(100),
      description: z.string().max(4000),
      warranty: z.string().max(2000),
      sku: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(150),
      attributes: z.string().max(4000),
      price: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
      active: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Check the required fields, SKU, and price (up to two decimal places).",
    };
  const p = parsed.data;
  let attributes: Record<string, string>;
  try {
    attributes = z
      .record(z.string(), z.string().max(200))
      .parse(JSON.parse(p.attributes || "{}"));
  } catch {
    return {
      ok: false,
      message:
        'Attributes must be a JSON object, for example {"finish":"Chrome"}.',
    };
  }
  const client = await serverClient();
  const { data, error } = await client.rpc("save_catalogue", {
    p_product_id: p.product_id,
    p_variant_id: p.variant_id,
    p_name: p.name,
    p_category: p.category,
    p_brand: p.brand,
    p_description: p.description,
    p_warranty: p.warranty || null,
    p_sku: p.sku,
    p_label: p.label,
    p_attributes: attributes,
    p_price_minor: parseMoney(p.price),
    p_active: p.active === "on",
  });
  if (!error) revalidatePath("/catalogue");
  return mutationResult(
    error,
    "Catalogue saved. Historical orders and invoices retain their original values.",
    String(data ?? ""),
  );
}
export async function uploadImage(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession("manageCatalogue");
  return storeCatalogueImage(await serverClient(), form);
}
