# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multiplayer chess: a Next.js client, a Bun/Express WebSocket server, and shared packages, in a Turborepo monorepo managed with **bun** (not npm/pnpm — `bun.lock` is the lockfile).

Note: `README.md` is the unmodified Turborepo starter README and does not describe this project.

Current work plan and task ordering: `docs/todo.md`.

## Commands

Run from the repo root:

```sh
bun install
bun run dev                      # all apps: web on :3000, server on :8001
bun run dev --filter=web         # single app
bun run build                    # includes `prisma generate` in packages/db
bun run lint                     # eslint --max-warnings 0 in every package
bun run check-types              # tsc --noEmit in every package
bun run format                   # prettier over **/*.{ts,tsx,md}
```

Database (Prisma 7, Postgres):

```sh
bun run db:migrate --filter=@repo/db   # prisma migrate dev
bun run db:deploy --filter=@repo/db    # prisma migrate deploy
bun run db:studio --filter=@repo/db
```

**No test runner is configured** in any package. If tests are needed, one has to be set up first (`bun test` is the natural fit given Bun is already the runtime).

## Setup

`DATABASE_URL` is set in the root **`.env`** file — both `packages/db/prisma.config.ts` and `apps/server/src/env.ts` load from the root `.env` file directly.

## Architecture

### Workspaces

- `apps/web` — Next.js 16 App Router + React 19. Currently still the starter page; no WebSocket client yet.
- `apps/server` — Express 5 + `ws`, run by `bun --watch src/index.ts`. Port **8001 is hardcoded** in `apps/server/src/index.ts`.
- `packages/game-core` (`@repo/game-core`) — shared game types/logic. Depends on `chess.js`, currently unused; only `EventType` is exported.
- `packages/db` (`@repo/db`) — Prisma client wrapper.
- `packages/eslint-config`, `packages/typescript-config` — shared configs.

### JIT packages

`@repo/game-core` and `@repo/db` export `./src/index.ts` directly (`"exports": { ".": "./src/index.ts" }`) with `noEmit: true`. Consumers compile the TypeScript source themselves — there is no build step or `dist/` for these, so no need to rebuild them after an edit.

### WebSocket layer

Single HTTP server hosts both Express routes and the `WebSocketServer` (`apps/server/src/index.ts`). Wire protocol is JSON; event names come from the `EventType` enum in `packages/game-core/src/types/events.ts` (`game:join`, `game:move`, `game:state`, …) — **add new events there**, not as string literals in the server.

`GameSocketManager` (`apps/server/src/sockets/game-socket.ts`) is a module-level singleton holding in-memory room state: `rooms: Map<gameId, Set<WebSocket>>` plus a reverse `socketToGame` index. A socket belongs to at most one game; `joinRoom` leaves the previous room first, and empty rooms are deleted. All of this is lost on server restart — nothing is persisted to the DB yet.

Two message dispatchers currently exist and **only one is wired up**: `registerSocket` in `sockets/socket.ts` handles messages inline (keyed on `message.type`, `GAME_JOIN` only) and is what `index.ts` calls. `sockets/handle-message.ts` is a more complete dispatcher (keyed on `message.event`, handles join and leave) but is never imported. Reconcile these rather than adding a third path — note the two disagree on the message field name (`type` vs `event`).

### Prisma

The client is generated into `packages/db/src/generated/` (gitignored, produced by `bun run build`), and re-exported from `packages/db/src/index.ts` so consumers import from `@repo/db` and never reach into `src/generated`. `src/client.ts` uses the `@prisma/adapter-pg` driver adapter and caches the client on `globalThis` outside production to survive hot reloads.

`packages/db/turbo.json` makes that package's `lint` and `check-types` depend on its `build`, so generation runs before anything typechecks the generated code.

## Conventions

- `eslint-plugin-only-warn` downgrades every rule to a warning, but all `lint` scripts run `--max-warnings 0`, so warnings still fail the task.
- `verbatimModuleSyntax` is on everywhere — use `import type { … }` for type-only imports.
- `noUncheckedIndexedAccess` is on — indexing an array yields `T | undefined`.
- Server and game-core are ESM (`"type": "module"`).
- `turbo.json` defines a no-op `transit` task that `lint` and `check-types` depend on; it exists purely to force topological ordering across packages without requiring a real build.
