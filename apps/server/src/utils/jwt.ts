import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
}

export interface JwtPayload {
    userId: string;
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET!);
        if (typeof decoded === "object" && decoded !== null && "userId" in decoded) {
            return decoded as JwtPayload;
        }
        return null;
    } catch {
        return null;
    }
}
