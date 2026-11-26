import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const secret = process.env.SUPABASE_SECRET_KEY;
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(join(directory, e.name))
          : [join(directory, e.name)],
      ),
    )
  ).flat();
}
let inspected = 0;
for (const file of await files("mobile/dist")) {
  if (!/\.(js|html|css|json)$/.test(file)) continue;
  const text = await readFile(file, "utf8");
  if (
    /sb_secret_[A-Za-z0-9_-]{12,}|SUPABASE_SECRET_KEY/.test(text) ||
    (secret && text.includes(secret))
  ) {
    throw new Error(
      `Privileged configuration detected in ${file}. Do not distribute this build.`,
    );
  }
  inspected++;
}
console.log(
  `Mobile bundle verified: ${inspected} text assets contain no privileged configuration.`,
);
