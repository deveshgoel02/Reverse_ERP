import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the connection URL for the CLI (migrate/studio/db push) out
// of schema.prisma and into this file. The application's PrismaClient gets
// its own connection via a driver adapter — see src/lib/db.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed/seed.ts",
  },
});
