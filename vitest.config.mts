import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set — see .env.example.");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "test-secret-do-not-use-in-production-000000",
    },
    fileParallelism: false,
    // Integration tests do several sequential round-trips to a real (remote)
    // Postgres database — Vitest's 5s default is tuned for local/mocked
    // tests, not network latency.
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
