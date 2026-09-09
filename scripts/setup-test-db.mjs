// Cross-platform test DB bootstrap: applies migrations to a dedicated
// prisma/test.db file so integration tests never touch the dev database.
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const testDbPath = path.join(process.cwd(), "prisma", "test.db");
if (existsSync(testDbPath)) unlinkSync(testDbPath);

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
});
