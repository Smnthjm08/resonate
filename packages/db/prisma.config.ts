import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Resolved from this file, not the cwd, so Prisma commands work from anywhere.
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(packageRoot, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required — copy packages/db/.env.example to packages/db/.env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
