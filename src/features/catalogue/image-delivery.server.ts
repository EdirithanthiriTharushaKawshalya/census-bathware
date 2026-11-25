import "server-only";
import { requireSession } from "@/features/auth/session";
import { serverClient } from "@/lib/supabase/server";
import { BoundedCache } from "@/lib/cache/bounded-cache";
import { IMAGE_POLICY, validImagePath } from "./image-policy";
import type { ProductImage } from "@/types/domain";

// Intentional bounded cache of image capabilities, partitioned by actor/project.
// Every read is preceded by fresh request authorization. No JWT/session is cached here.
const signedImages = new BoundedCache<string>(1200);

export async function imageSources(images: ProductImage[]) {
  const actor = await requireSession("catalogue");
  const client = await serverClient();
  const paths = [
    ...new Set(
      images.flatMap((image) =>
        image.variants?.length
          ? image.variants.map((v) => v.path)
          : [image.path],
      ),
    ),
  ].filter(validImagePath);
  const urls = new Map<string, string>();
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}:${actor.id}:`;
  const missing: string[] = [];
  for (const path of paths) {
    const cached = signedImages.get(prefix + path);
    if (cached) urls.set(path, cached);
    else missing.push(path);
  }
  // Storage's batch signing API replaces the previous one-request-per-image flow.
  if (missing.length) {
    const { data, error } = await client.storage
      .from("catalogue")
      .createSignedUrls(missing, IMAGE_POLICY.signedUrlSeconds);
    if (!error)
      for (const item of data || [])
        if (item.path && item.signedUrl && !item.error) {
          urls.set(item.path, item.signedUrl);
          signedImages.set(
            prefix + item.path,
            item.signedUrl,
            (IMAGE_POLICY.signedUrlSeconds - 45) * 1000,
          );
        }
  }
  return urls;
}
