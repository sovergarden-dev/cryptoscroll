import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    { name: "chromium", testIgnore: "**/accessibility.spec.ts", use: { browserName: "chromium" } },
    { name: "firefox", testIgnore: "**/accessibility.spec.ts", use: { browserName: "firefox" } },
    { name: "webkit", testIgnore: "**/accessibility.spec.ts", use: { browserName: "webkit" } },
    {
      name: "accessibility-firefox",
      testMatch: "**/accessibility.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "accessibility-chromium",
      testMatch: "**/accessibility.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "accessibility-webkit",
      testMatch: "**/accessibility.spec.ts",
      use: { browserName: "webkit" },
    },
  ],
  use: {
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
});
