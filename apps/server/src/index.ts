import "./env";

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";
import { guestUserSignup, userSignup, userSignin } from "./routes/auth.routes";
import { createGame } from "./routes/game.routes";
import { authMiddleware } from "./middlewares/auth.middleware";

const BACKEND_PORT = process.env.BACKEND_PORT ?? 8001;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", healthRoute);

app.post("/api/v1/auth/guest", guestUserSignup);
app.post("/api/v1/auth/signup", userSignup);
app.post("/api/v1/auth/signin", userSignin);
app.post("/api/v1/game", authMiddleware, createGame);

const server = createServer(app);

const wss = new WebSocketServer({ server });

registerSocket(wss);

server.listen(BACKEND_PORT, () => {
  console.log(`server is running on port ${BACKEND_PORT}`);
});

export default app;
