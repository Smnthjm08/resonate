# Backend + WebSocket TODO

Goal: a working multiplayer chess backend (server + WS + persistence). **No frontend work until Phase 3 is done.**

A "sitting" = one focused 60–90 min block. One task at a time; each ends in a commit that builds, lints, and typechecks. Don't start a phase until the previous one is green.

## Progress

- **Phase 0 — Foundation** ✅ One WS dispatcher, typed `ClientMessage`/`ServerMessage` in `game-core`, `sendMessage` helper, zod validation at the boundary, `GAME_ERROR` on every failure path, env loading fixed.
- **Phase 1 — Domain model** ✅ `Game` (status, players, `fen`, `result`) + `Move` migrated; guest auth at `POST /api/v1/auth/guest`; sockets carry a `userId`.
- **Phase 2 — Game lifecycle** ✅ Create/join/list over HTTP, room broadcast, `GAME_STATE` on join. Grew past the original scope — see "Built beyond the plan" below.
- **Phase 4 sitting 1 — Connection churn** ✅ Done early, out of order: disconnect survives, reconnect restores state.
- **Phase 3 — Moves** ← next. Blocked on one thing first: [socket identity](#before-phase-3).
- **Phase 4 sitting 2 — Clocks** — not started.

## Built beyond the plan

Shipped but never written down, so it doesn't get re-planned or re-litigated:

- **Full password auth, not just guests** — `POST /api/v1/auth/signup` and `/signin` (`auth.controller.ts`), hashing via `Bun.password`, 7-day JWTs from `utils/jwt.ts`.
- **`authMiddleware`** (`middlewares/auth.middleware.ts`) — verifies the bearer token, loads the user, sets `req.user`. Applied to the two mutating game routes only; the two read routes are public.
- **Game routes are `/api/v1/games`, plural**, not `POST /game` as the plan said:
  - `GET /` — list, optional `?status=` filter, players included.
  - `GET /:gameId` — one game with players and moves ordered by `moveNumber`.
  - `POST /` — create (auth).
  - `POST /:gameId/join` — join (auth).
- **Single-active-game constraint** — create, HTTP join, and WS `GAME_JOIN` all reject a user who is already in a _different_ `ACTIVE` game.
- **`docs/postman_collection.json`** — covers health, all three auth endpoints, all four game endpoints. Keep it in step when routes change.

## Open items

- [x] **Socket identity is client-asserted** — fixed. Socket is authenticated via JWT (`ws://localhost:8001?token=<JWT>`), `data.userId` dropped from client `GAME_JOIN`.
- [ ] **`GAME_STATE` doesn't say what the receiver is** — no `role: "white" | "black" | "spectator"` field, so a client can't tell whether to render a draggable board. Phase 3 needs the same distinction server-side to reject spectator moves; add the field when the move handler lands.
- [x] **HTTP join doesn't reach the WS room** — fixed. `POST /:gameId/join` now broadcasts updated `GAME_STATE` directly to all connected sockets in the room when a player joins.
- [ ] **`Move` stores only `san` + `fen`** — no `from`/`to`/`promotion` columns. Enough to replay a game, not enough to highlight the last move without re-parsing SAN. Decide in Phase 3 sitting 2, before the table has data in it.
- [ ] **`GET /games` returns every game ever** — no pagination, no cap. Fine at current volume, will not stay fine.
- [x] **Bug: `leaveRoom` deletes the session unconditionally** — fixed, now guards on `room.has(socket)`.
- [x] **Decide the wire-message shape** — settled on the `{ type, gameId?, data? }` envelope.
- [x] **`error: error` serializes to `{}`** in `auth.routes.ts` — now `error instanceof Error ? error.message : "Unknown error"` everywhere.
- [x] **`DATABASE_URL` is in two places** — single root `.env` now.
- [x] **Port fallback mismatch** — `index.ts` falls back to 8001.
- [x] **`zod` declared in both `apps/server` and `packages/game-core`.**
- [x] Cosmetic: `env.ts` comment, `events.ts` header.

## Before Phase 3

One task, and it has to come first because the whole move handler is built on top of it.

- [x] **Authenticate the socket, don't take its word for it.** Phase 3's turn check is `getUserId(socket)` vs `whiteId`/`blackId` — verified socket identity via JWT connection upgrade (`ws://localhost:8001?token=<JWT>`), stored `userId` on session, dropped `data.userId` from client `GAME_JOIN` payload & Zod schema.

## Phase 3 — Moves (2 sittings, realistically 3)

The core. Hardest part of the project.

### Sitting 1 — validate & apply

- [x] **Engine wrapper in `game-core`** — wrapped `chess.js`: `createEngine`, `tryMove`, `getOutcome`. The only package that imports `chess.js`.
- [x] **In-memory instance cache** — `gameEngineCache` manager (`Map<gameId, ChessEngine>`) on the server.
- [x] **Add `GAME_MOVE` to the wire types** — `{ type, gameId, data: { from, to, promotion? } }` in `ClientMessage`, `ServerMessage`, and Zod `schema.ts`.
- [x] **Handle `GAME_MOVE`** — server checks status is `ACTIVE`, resolves sender via authenticated session, verifies turn (`whiteId`/`blackId`), rejects non-players/spectators, and validates move legality with `tryMove`. Illegal → `GAME_ERROR` to sender only.

### Sitting 2 — persist & finish

- [ ] **Persist the move** — `Move` row + `Game.fen` update in one transaction, then broadcast `GAME_STATE`. `moveNumber` is `@@unique([gameId, moveNumber])`, so derive it inside the transaction, not from a stale count.
- [ ] **Detect game over** — `getOutcome` after each move → set `status`, `result`, and `winnerId` (the column exists and nothing writes to it yet), broadcast, evict the cached instance.

## Phase 4 — Robustness

### Sitting 1 — connection churn ✅

- [x] **Survive disconnect** — `close` drops the socket from the room only; broadcasts `GAME_LEAVE`.
- [x] **Reconnect** — rejoining with the same `userId` restores state from the DB; `userSockets: Map<userId, WebSocket>` evicts the stale socket.

### Sitting 2 — clocks

- [ ] **Schema first** — no clock columns exist. `Game` needs per-player remaining time and a `lastMoveAt` to charge elapsed time against; a migration comes before any of the handler work.
- [ ] **Clocks** — `GAME_PAUSE`/`GAME_RESUME` + per-player time. `GameStatus.PAUSED` and `GameResult.TIMEOUT` are already in the enums, unused. Last on purpose: the only piece needing server-side timers, and it touches move handling.

---

## Decisions

Record choices here as you make them so you don't re-litigate them next sitting.

### Architecture

- **Colour assignment is HTTP, not WebSocket.** The plan had `GAME_JOIN` filling the empty slot; it ended up in `POST /games/:gameId/join`, which assigns white/black, flips the game to `ACTIVE` when black arrives, and 400s a third player. The WS `GAME_JOIN` only puts a socket in a room and replays state — so anyone who skips the HTTP join and opens a socket is a spectator by construction. Spectators are a side effect of that split, not a separate code path.
- **`chess.js` stays inside `packages/game-core`.** The server never imports it — it decides _who_ may move and _when_, never _whether a move is legal_.
- **`GameSocketManager` is pure** — in-memory rooms and sessions, no I/O, no async. Validation happens in `handle-message.ts` before calling in, so nothing mutates on input that turns out to be bad. Its three maps (`rooms`, `sessions`, `userSockets`) are all lost on restart, which is fine: the DB rehydrates them on rejoin.
- **`handleMessage` is async, `ws.on("message")` doesn't await it** — hence the `.catch` in `socket.ts`. Without it a DB error is an unhandled rejection that kills the process instead of failing one message.
- **One `sessions: Map<WebSocket, {userId, gameId}>`**, not two parallel maps — same key, same lifetime, can't desync.
- **One socket per user** — `joinRoom` calls `leaveAllRooms` on any previous socket for that `userId`. Reconnect is therefore takeover, not a second seat.

### Conventions

- **Wire protocol field is `type`**, not `event`. `ClientMessage`/`ServerMessage` in `game-core` are the source of truth; the client must mirror it.
- **HTTP response envelope is `{ success, error, data, message }`** — every controller returns it on both paths, including 4xx.
- **Message validation lives in the server** (`apps/server/src/sockets/schema.ts`), annotated `z.ZodType<ClientMessage>` so it can't drift from the shared type. If the web client ever needs it, move it to `game-core` and derive `ClientMessage` via `z.infer`.
- **Auth is a 7-day JWT carrying `{ userId }`**, `Authorization: Bearer <token>`. Guest and password signup both return one from the same `signToken`.

### Gotchas worth remembering

- **Env loading is anchored to the file, not the cwd** (`apps/server/src/env.ts`, imported first). Relative-to-cwd paths broke because turbo runs tasks with cwd = the package dir.
- **`apps/server` has no Node types** — tsconfig pins `"types": ["bun"]`, so `node:path` / `node:url` won't typecheck. Use `import.meta.dir` etc.
- **`prisma generate` and `prisma migrate` are separate** — the client and DB can drift, and `prisma migrate status` does _not_ detect it. Use `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
- **Unique constraints beat pre-checks** — guest usernames retry on `P2002` rather than `findUnique`-then-`create`, which has a race. `instanceof Prisma.PrismaClientKnownRequestError` does hold when imported via `@repo/db`.
- **`authMiddleware` puts the whole `User` row on `req.user`**, password hash included. Nothing serializes it today; don't start.
