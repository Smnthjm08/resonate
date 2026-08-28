import type { AuthUser } from "../utils/session";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
