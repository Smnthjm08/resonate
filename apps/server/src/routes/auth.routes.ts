import type { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";

const adjectives = [
  "Silent",
  "Swift",
  "Crimson",
  "Golden",
  "Shadow",
  "Cosmic",
  "Rapid",
  "Noble",
  "Mystic",
  "Electric",
  "Lucky",
  "Frosty",
  "Velvet",
  "Bright",
  "Atomic",
  "Binary",
  "Quantum",
  "Turbo",
  "Neon",
  "Iron",
];

const nouns = [
  "Wolf",
  "Falcon",
  "Tiger",
  "Fox",
  "Raven",
  "Bear",
  "Lion",
  "Panda",
  "Otter",
  "Shark",
  "Phoenix",
  "Comet",
  "Meteor",
  "Byte",
  "Kernel",
  "Stack",
  "Pixel",
  "Cobra",
  "Jaguar",
  "Eagle",
];

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  const digits = Math.floor(1000 + Math.random() * 9000);

  return `${adjective}${noun}${digits}`;
}

const MAX_USERNAME_ATTEMPTS = 5;

async function createGuestUser() {
  for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt++) {
    try {
      return await prisma.user.create({
        data: { username: generateUsername() },
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

    res.status(201).json({
      success: true,
      error: null,
      data: user,
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
