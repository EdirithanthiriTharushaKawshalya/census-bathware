"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { mutationResult } from "@/lib/supabase/result";
import { parseMoney } from "@/features/billing/money";
import type { ActionState } from "@/types/domain";
import { catalogueStorageWriter } from "@/lib/supabase/storage-writer";
import { IMAGE_POLICY } from "./image-policy";
import {
  ImageValidationError,
  processCatalogueImage,
} from "./image-processing.server";
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
  const id = z.uuid().safeParse(form.get("product_id"));
  const alt = z.string().trim().min(1).max(250).safeParse(form.get("alt"));
  const file = form.get("image");
  if (
    !id.success ||
    !alt.success ||
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > IMAGE_POLICY.maxUploadBytes ||
    !file.size
  )
    return {
      ok: false,
      message:
        "Select a JPEG, PNG, or WebP image up to 8 MB and provide alt text.",
    };
  const client = await serverClient();
  const { data: allowed, error: limitError } =
    await client.rpc("allow_image_upload");
  if (limitError)
    return {
      ok: false,
      message:
        "Image uploads require the latest security/image migration. Contact your administrator.",
    };
  if (!allowed)
    return {
      ok: false,
      message: "Your hourly upload limit has been reached. Please try later.",
    };
  const { data: product, error: productError } = await client
    .from("products")
    .select("id")
    .eq("id", id.data)
    .maybeSingle();
  if (productError || !product)
    return { ok: false, message: "Product not found or access denied." };
  const storage = catalogueStorageWriter();
  if (!storage)
    return {
      ok: false,
      message:
        "Image uploads need a server-only Supabase storage key. Ask your administrator to configure it.",
    };
  try {
    const optimized = await processCatalogueImage(
      Buffer.from(await file.arrayBuffer()),
    );
    const { data: existing } = await client
      .from("product_images")
      .select("id")
      .eq("product_id", id.data)
      .eq("content_hash", optimized.hash)
      .maybeSingle();
    if (existing)
      return {
        ok: true,
        message: "This photograph is already in the product catalogue.",
      };
    const manifest = [];
    for (const image of optimized.variants) {
      const path = `${id.data}/${optimized.hash}/${image.width}.webp`;
      const { error } = await storage.upload(path, image.buffer, {
        contentType: "image/webp",
        cacheControl: String(IMAGE_POLICY.browserCacheSeconds),
        upsert: false,
      });
      if (error && error.message !== "The resource already exists")
        return mutationResult(error, "");
      manifest.push({
        path,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
      });
    }
    const { error } = await client.rpc("attach_catalogue_image", {
      p_product_id: id.data,
      p_hash: optimized.hash,
      p_variants: manifest,
      p_alt: alt.data,
    });
    if (!error) revalidatePath("/catalogue");
    // Do not delete objects on failure: another simultaneous retry may have attached
    // them. Unreferenced objects are safe to reclaim later through trusted maintenance.
    return mutationResult(
      error,
      `Image uploaded in ${manifest.length} compressed size${manifest.length === 1 ? "" : "s"}. Location and camera metadata removed.`,
    );
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ImageValidationError
          ? error.message
          : "Image processing failed. Try another photograph.",
    };
  }
}
