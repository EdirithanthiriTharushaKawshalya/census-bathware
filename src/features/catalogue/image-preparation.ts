import { IMAGE_POLICY } from "./image-policy";

/** Optional browser bandwidth optimization. Server decoding remains authoritative. */
export async function prepareImage(file: File): Promise<File> {
  if (!file.size || file.size > IMAGE_POLICY.maxUploadBytes)
    throw new Error("Choose an image up to 8 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (typeof createImageBitmap !== "function") return file;
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > IMAGE_POLICY.maxPixels)
      throw new Error("Choose an image under 20 megapixels.");
    const scale = Math.min(
      1,
      IMAGE_POLICY.maxEdge / Math.max(image.width, image.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size)
      return file;
    return new File([blob], "catalogue.webp", { type: "image/webp" });
  } finally {
    image.close();
  }
}
