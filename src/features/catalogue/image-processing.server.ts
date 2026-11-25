import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { IMAGE_POLICY } from "./image-policy";

export class ImageValidationError extends Error {}
let activeJobs = 0;

/** Decode pixels rather than trusting a filename/MIME header. Never retain EXIF/GPS. */
export async function processCatalogueImage(input: Buffer) {
  if (activeJobs >= 2)
    throw new ImageValidationError(
      "Image processing is busy. Please try again shortly.",
    );
  activeJobs++;
  try {
    return await decodeImage(input);
  } finally {
    activeJobs--;
  }
}
async function decodeImage(input: Buffer) {
  if (!input.length || input.length > IMAGE_POLICY.maxUploadBytes)
    throw new ImageValidationError("Choose an image up to 8 MB.");
  const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp)
    throw new ImageValidationError(
      "The file contents must be JPEG, PNG, or WebP.",
    );
  try {
    const metadata = await sharp(input, {
      limitInputPixels: IMAGE_POLICY.maxPixels,
      failOn: "warning",
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages || 1) !== 1
    )
      throw new ImageValidationError(
        "Choose a single JPEG, PNG, or WebP image. SVG and animations are not supported.",
      );
    if (metadata.width * metadata.height > IMAGE_POLICY.maxPixels)
      throw new ImageValidationError(
        "The image exceeds the 20 megapixel limit.",
      );
    const hash = createHash("sha256").update(input).digest("hex");
    const outputs: {
      width: number;
      height: number;
      bytes: number;
      buffer: Buffer;
    }[] = [];
    // Sequential encoding keeps peak memory bounded on small server instances.
    for (const edge of IMAGE_POLICY.edges) {
      const { data, info } = await sharp(input, {
        limitInputPixels: IMAGE_POLICY.maxPixels,
        failOn: "warning",
      })
        .rotate()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_POLICY.quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (
        outputs.some(
          (image) => image.width === info.width && image.height === info.height,
        )
      )
        continue;
      if (data.length > 2 * 1024 * 1024)
        throw new ImageValidationError(
          "This image is too complex to optimize. Try a smaller photograph.",
        );
      outputs.push({
        width: info.width,
        height: info.height,
        bytes: data.length,
        buffer: data,
      });
    }
    return { hash, variants: outputs };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError(
      "This file could not be decoded safely. Choose a valid image under 20 megapixels.",
    );
  }
}
