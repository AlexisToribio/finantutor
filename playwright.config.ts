import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./frontend/e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:5180", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command:
      "pnpm --filter frontend exec vite --host 127.0.0.1 --port 5180 --strictPort",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
    env: { VITE_AUTH_MODE: "local", VITE_LOCAL_TOKEN: "finantutor-local" },
  },
});
