import { defineConfig } from "@playwright/test";
import "dotenv/config";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
