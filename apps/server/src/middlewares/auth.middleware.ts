import type { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db";
import { verifyToken } from "../utils/jwt";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Missing authorization token",
      data: null,
      message: "Unauthorized",
    });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
      data: null,
      message: "Unauthorized",
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.userId,
    },
    select: {
      id: true,
      username: true,
      isGuest: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found",
      data: null,
      message: "User not found",
    });
  }

  req.user = user;
  next();
}

export default authMiddleware;
