import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { supabaseConfig } from "../src/lib/env/public";

export default defineConfig(({ mode }) => {
  // Deliberately allowlist configuration. Never serialize process.env/loadEnv wholesale.
  const env = loadEnv(mode, process.cwd(), [
    "NEXT_PUBLIC_",
    "MOBILE_WEB_APP_URL",
  ]);
  const publicUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const saved = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ];
  process.env.NEXT_PUBLIC_SUPABASE_URL = publicUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
  const config = supabaseConfig();
  for (const [index, key] of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].entries()) {
    if (saved[index] === undefined) delete process.env[key];
    else process.env[key] = saved[index];
  }
  const website =
    process.env.MOBILE_WEB_APP_URL ?? env.MOBILE_WEB_APP_URL ?? "";
  if (
    website &&
    (!URL.canParse(website) ||
      new URL(website).protocol !== "https:" ||
      new URL(website).origin !== website.replace(/\/$/, ""))
  ) {
    throw new Error(
      "MOBILE_WEB_APP_URL must be an HTTPS origin without a path.",
    );
  }
  return {
    root: resolve(process.cwd(), "mobile"),
    publicDir: false,
    plugins: [
      react(),
      {
        name: "census-mobile-csp",
        transformIndexHtml(html) {
          const supabaseOrigin = config?.url || "";
          const socketOrigin = supabaseOrigin.replace(/^https:/, "wss:");
          return html
            .replace(
              "connect-src 'self' https: wss:",
              `connect-src 'self' ${supabaseOrigin} ${socketOrigin} ${website}${mode === "development" ? " ws://127.0.0.1:5173" : ""}`,
            )
            .replace(
              "img-src 'self' data: https:",
              `img-src 'self' data: ${supabaseOrigin}`,
            )
            .replace(
              "script-src 'self'",
              `script-src 'self'${mode === "development" ? " 'unsafe-inline'" : ""}`,
            );
        },
      },
    ],
    resolve: { alias: { "@": resolve(process.cwd(), "src") } },
    define: {
      __SUPABASE_CONFIG__: JSON.stringify(config),
      __WEB_APP_URL__: JSON.stringify(website.replace(/\/$/, "")),
    },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  };
});
