import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "../utils/session";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = await getSessionUser(req.headers);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Not signed in",
      data: null,
      message: "Unauthorized",
    });
  }

  req.user = user;
  next();
}

export default authMiddleware;
