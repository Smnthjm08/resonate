import { prisma } from "@repo/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous } from "better-auth/plugins/anonymous";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { username } from "better-auth/plugins/username";
import { generateUsername } from "./generate-username";
import { linkGuestGames } from "./link-guest-games";

export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Chess",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [WEB_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    // Guests get a throwaway account with a chess-handle display name.
    // `username` stays null for them — only credential users pick one.
    // Signing up or in from a guest session links the two: the guest's games
    // move across before Better Auth deletes the guest row.
    anonymous({
      generateName: () => generateUsername(),
      onLinkAccount: ({ anonymousUser, newUser }) =>
        linkGuestGames(anonymousUser.user.id, newUser.user.id),
    }),
    username(),
    // Short-lived single-use tickets, used to authenticate a WebSocket
    // upgrade when the session cookie can't ride along (see apps/server).
    // Verification is server-side only, so there is no response to set a
    // cookie on — the ticket resolves the session it was minted from.
    oneTimeToken({ storeToken: "hashed", disableSetSessionCookie: true }),
  ],
});

// Re-exported so the server never imports `better-auth` directly. The web
// app depends on it too, but only for `better-auth/react` (lib/auth-client).
export { fromNodeHeaders, toNodeHandler } from "better-auth/node";

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;

export { generateUsername };
export { linkGuestGames };
