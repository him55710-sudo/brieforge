import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "**/*.spec.ts", fullyParallel: true,
  use: { baseURL: "http://localhost:3100", headless: true },
  webServer: { command: "npm run start -- --port 3100", url: "http://localhost:3100/api/health", reuseExistingServer: false, timeout: 60000, env: { OPENAI_API_KEY: "" } },
});
