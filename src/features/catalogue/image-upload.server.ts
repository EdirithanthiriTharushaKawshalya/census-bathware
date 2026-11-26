import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/types/domain";
import { mutationResult } from "@/lib/supabase/result";
import { catalogueStorageWriter } from "@/lib/supabase/storage-writer";
import { IMAGE_POLICY } from "./image-policy";
import {
  ImageValidationError,
  processCatalogueImage,
} from "./image-processing.server";
export async function storeCatalogueImage(
  client: SupabaseClient,
  form: FormData,
): Promise<ActionState> {
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
