import type { User } from "@repo/db";

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, "password">;
    }
  }
}
