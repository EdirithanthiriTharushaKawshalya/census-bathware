import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results/mobile",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command:
      "npm run mobile:build && npx vite preview --config mobile/vite.config.ts --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://census-mobile-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mobile_test_only",
      SUPABASE_SECRET_KEY: "sb_secret_MOBILE_BUNDLE_TEST_MUST_NOT_APPEAR",
    },
  },
});
