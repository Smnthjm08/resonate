export { prisma } from "./client";

// Re-export the generated client so consumers never reach into `src/generated`.
export * from "./generated/prisma/client";
