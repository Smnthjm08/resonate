import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to the .env file of the app importing @repo/db.",
  );
}

const createPrismaClient = () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Dev servers re-evaluate modules on every hot reload; caching the client on
// globalThis keeps a single connection pool instead of one per reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
