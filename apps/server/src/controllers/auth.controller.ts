import type { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import { signToken } from "../utils/jwt";
import { generateUsername } from "../utils/generate-username";
import { MAX_USERNAME_ATTEMPTS } from "../constants";

async function createGuestUser() {
  for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt++) {
    try {
      return await prisma.user.create({
        data: { username: generateUsername(), isGuest: true },
      });
    } catch (error) {
      const isDuplicateUsername =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (!isDuplicateUsername || attempt === MAX_USERNAME_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error("unreachable");
}

export async function guestUserSignup(req: Request, res: Response) {
  try {
    const user = await createGuestUser();
    const token = signToken({ userId: user.id });

    res.status(201).json({
      success: true,
      error: null,
      data: { user, token },
      message: "Guest user created successfully",
    });
  } catch (error) {
    console.error("Error signingup guest", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Failed to create User!",
    });
  }
}

export async function userSignup(req: Request, res: Response) {
  try {
    const { username, password } = req.body ?? {};

    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length < 3
    ) {
      return res.status(400).json({
        success: false,
        error: "Username must be at least 3 characters long",
        data: null,
        message: "Invalid username",
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long",
        data: null,
        message: "Invalid password",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Username already taken",
        data: null,
        message: "Username already taken",
      });
    }

    const hashedPassword = await Bun.password.hash(password);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        isGuest: false,
      },
      select: {
        id: true,
        username: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const token = signToken({ userId: user.id });

    res.status(201).json({
      success: true,
      error: null,
      data: { user, token },
      message: "User registered successfully",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(400).json({
        success: false,
        error: "Username already taken",
        data: null,
        message: "Username already taken",
      });
    }

    console.error("Error signing up user", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Failed to register user",
    });
  }
}

export async function userSignin(req: Request, res: Response) {
  try {
    const { username, password } = req.body ?? {};

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required",
        data: null,
        message: "Missing credentials",
      });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
        data: null,
        message: "Authentication failed",
      });
    }

    const isMatch = await Bun.password.verify(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
        data: null,
        message: "Authentication failed",
      });
    }

    const token = signToken({ userId: user.id });

    const safeUser = {
      id: user.id,
      username: user.username,
      isGuest: user.isGuest,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      error: null,
      data: { user: safeUser, token },
      message: "User signed in successfully",
    });
  } catch (error) {
    console.error("Error signing in user", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Failed to sign in",
    });
  }
}
