import type { NextFunction, Request, Response } from "express";
import { auth } from "@repo/auth";
import { prisma } from "@repo/db";
import { verifyToken } from "../utils/jwt";

function requestHeaders(req: Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value)
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: requestHeaders(req),
  });

  if (session) {
    req.user = {
      id: session.user.id,
      username: session.user.name || session.user.id,
      isGuest: session.user.isAnonymous ?? false,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
    return next();
  }

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

  req.user = {
    ...user,
    username: user.username ?? user.id,
  };
  next();
}

export default authMiddleware;
