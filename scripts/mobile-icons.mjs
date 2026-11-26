import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";

const master = "src/assets/census-favicon-master.png";
const android = "android/app/src/main/res";
const ios = "ios/App/App/Assets.xcassets";
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const directory = `${android}/mipmap-${density}`;
  await mkdir(directory, { recursive: true });
  for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
    await sharp(master).resize(size, size).png().toFile(`${directory}/${name}`);
  }
  // Adaptive foreground has a generous safe margin to preserve the entire mark.
  const canvas = Math.round((size * 108) / 48);
  const mark = await sharp(master).resize(size, size).png().toBuffer();
  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(`${directory}/ic_launcher_foreground.png`);
}
await mkdir(`${ios}/AppIcon.appiconset`, { recursive: true });
await sharp(master)
  .resize(1024, 1024)
  .flatten({ background: "#000000" })
  .png()
  .toFile(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`);
for (const name of [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
]) {
  await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: "#102f2b" },
  })
    .composite([
      {
        input: await sharp(master).resize(512).png().toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toFile(`${ios}/Splash.imageset/${name}`);
}
for (const resource of [
  "drawable",
  "drawable-land-hdpi",
  "drawable-land-mdpi",
  "drawable-land-xhdpi",
  "drawable-land-xxhdpi",
  "drawable-land-xxxhdpi",
  "drawable-port-hdpi",
  "drawable-port-mdpi",
  "drawable-port-xhdpi",
  "drawable-port-xxhdpi",
  "drawable-port-xxxhdpi",
]) {
  // Remove only the known generated file; retain all other native resources.
  await unlink(`${android}/${resource}/splash.png`).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
await mkdir(`${android}/drawable-nodpi`, { recursive: true });
await sharp({
  create: { width: 1280, height: 1280, channels: 3, background: "#102f2b" },
})
  .composite([
    {
      input: await sharp(master).resize(240).png().toBuffer(),
      gravity: "centre",
    },
  ])
  .png()
  .toFile(`${android}/drawable-nodpi/splash.png`);
const monochrome = await sharp(master)
  .resize(192)
  .flatten({ background: "#000000" })
  .greyscale()
  .raw()
  .toBuffer();
const rgba = Buffer.alloc(192 * 192 * 4);
for (let pixel = 0; pixel < 192 * 192; pixel++) {
  rgba[pixel * 4] = 255;
  rgba[pixel * 4 + 1] = 255;
  rgba[pixel * 4 + 2] = 255;
  rgba[pixel * 4 + 3] = monochrome[pixel];
}
await sharp(rgba, { raw: { width: 192, height: 192, channels: 4 } })
  .extend({
    top: 120,
    bottom: 120,
    left: 120,
    right: 120,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(`${android}/drawable-nodpi/ic_launcher_monochrome.png`);
await writeFile(
  `${android}/values/ic_launcher_background.xml`,
  '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#000000</color></resources>\n',
);
console.log("Census icons and launch screens generated for Android and iOS.");
