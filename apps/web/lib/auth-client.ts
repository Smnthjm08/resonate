import { createAuthClient } from "better-auth/react";
import { anonymousClient, usernameClient } from "better-auth/client/plugins";
import { serverUrl } from "./env";

/**
 * Better Auth is mounted on the game server, not on Next, so the client points
 * at `serverUrl`. It sends `credentials: "include"` by default, which is what
 * puts the session cookie on the cross-origin requests in `lib/api.ts` too.
 */
export const authClient = createAuthClient({
  baseURL: serverUrl,
  plugins: [anonymousClient(), usernameClient()],
});

export const { useSession, signOut } = authClient;

export type SessionUser = typeof authClient.$Infer.Session.user;

/** Mirrors the `username` plugin's defaults, so the form fails before the API does. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
export const MIN_PASSWORD_LENGTH = 8;

export function accountLabel(user: SessionUser) {
  return (
    user.displayUsername?.trim() || user.username?.trim() || user.name.trim()
  );
}
