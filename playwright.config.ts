import { defineConfig } from "@playwright/test";
const externalUrl = process.env.CENSUS_BROWSER_BASE_URL;
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: externalUrl || "http://localhost:3100",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: externalUrl
    ? undefined
    : {
        command: "npm.cmd run dev -- --port 3100",
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
