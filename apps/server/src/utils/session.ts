import type { IncomingHttpHeaders } from "http";
import { auth, fromNodeHeaders } from "@repo/auth";

export interface AuthUser {
  id: string;
  name: string;
  username: string | null;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toAuthUser(user: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): AuthUser {
  const extra = user as typeof user & {
    username?: string | null;
    isAnonymous?: boolean | null;
  };

  return {
    id: user.id,
    name: user.name,
    username: extra.username ?? null,
    isAnonymous: extra.isAnonymous ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Resolve the signed-in user from a request's session cookie. */
export async function getSessionUser(
  headers: IncomingHttpHeaders,
): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });

  return session ? toAuthUser(session.user) : null;
}

/**
 * Resolve the user behind a one-time ticket minted from an authenticated
 * session (`GET /api/auth/one-time-token/generate`). Tickets are single-use
 * and short-lived; `verifyOneTimeToken` throws rather than returning null.
 */
export async function getTicketUser(ticket: string): Promise<AuthUser | null> {
  try {
    const session = await auth.api.verifyOneTimeToken({
      body: { token: ticket },
    });

    return session ? toAuthUser(session.user) : null;
  } catch {
    return null;
  }
}
