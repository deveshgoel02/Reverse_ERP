// Applies migrations to the dedicated Neon test database (shoexpress_test)
// so integration tests never touch dev/production data. Requires
// TEST_DATABASE_URL to be set (see .env.example).
import "dotenv/config";
import { execSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is not set — see .env.example.");
  process.exit(1);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});
