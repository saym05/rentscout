import { defineConfig, devices } from "@playwright/test";

/** E2E against the real stack. The backend is started (and restarted) by the tests themselves: see e2e/backend.ts. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npx vite --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    env: { VITE_API_MODE: "http", VITE_API_URL: "http://localhost:8091" },
  },
});
