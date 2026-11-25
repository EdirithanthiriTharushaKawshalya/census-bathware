import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  processCatalogueImage,
  ImageValidationError,
} from "../src/features/catalogue/image-processing.server";
import {
  IMAGE_POLICY,
  validImagePath,
} from "../src/features/catalogue/image-policy";
import { BoundedCache } from "../src/lib/cache/bounded-cache";

test("image processing creates bounded WebP sizes, physically rotates and strips metadata", async () => {
  const source = await sharp({
    create: { width: 2200, height: 1400, channels: 3, background: "#afc8b4" },
  })
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Artist: "Private fixture metadata" } },
    })
    .jpeg({ quality: 96 })
    .toBuffer();
  const result = await processCatalogueImage(source);
  assert.equal(result.variants.length, 3);
  assert.match(result.hash, /^[a-f0-9]{64}$/);
  assert.equal(result.variants[2].height, 1600);
  for (const image of result.variants) {
    const metadata = await sharp(image.buffer).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.orientation, undefined);
    assert.ok(image.width <= 1600 && image.height <= 1600);
    assert.equal(image.bytes, image.buffer.length);
  }
  assert.ok(result.variants[2].bytes < source.length);
  console.log(
    `Fixture image: ${source.length} bytes -> ${result.variants[2].bytes} bytes at ${result.variants[2].width}x${result.variants[2].height}.`,
  );
});
test("small transparent images stay transparent and are never enlarged", async () => {
  const input = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const result = await processCatalogueImage(input);
  assert.equal(result.variants.length, 1);
  assert.equal(result.variants[0].width, 40);
  assert.equal(
    (await sharp(result.variants[0].buffer).metadata()).hasAlpha,
    true,
  );
});
test("forged, truncated, SVG and oversized image payloads are rejected", async () => {
  for (const payload of [
    Buffer.from("not an image"),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    ),
    Buffer.alloc(IMAGE_POLICY.maxUploadBytes + 1),
  ]) {
    await assert.rejects(processCatalogueImage(payload), ImageValidationError);
  }
  const input = await sharp({
    create: { width: 5000, height: 4100, channels: 3, background: "white" },
  })
    .jpeg({ quality: 10 })
    .toBuffer();
  await assert.rejects(processCatalogueImage(input), ImageValidationError);
});
test("signed-image cache expires, is bounded, and separates actor keys", () => {
  let now = 0;
  const cache = new BoundedCache<string>(2, () => now);
  cache.set("user-a:path", "first", 100);
  assert.equal(cache.get("user-b:path"), undefined);
  cache.set("user-b:path", "second", 100);
  cache.set("user-c:path", "third", 100);
  assert.equal(cache.get("user-a:path"), undefined);
  now = 101;
  assert.equal(cache.get("user-b:path"), undefined);
});
test("image paths cannot escape the catalogue namespace or name executable files", () => {
  const prefix = "10000000-0000-4000-8000-000000000001";
  assert.equal(validImagePath(`${prefix}/${"a".repeat(64)}/480.webp`), true);
  assert.equal(validImagePath(`${prefix}/../../script.svg`), false);
  assert.equal(validImagePath("https://evil.example/photo.webp"), false);
  assert.equal(validImagePath(`${prefix}/${"a".repeat(64)}/480.svg`), false);
});
