import "./env";

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";
import { guestUserSignup } from "./routes/auth.routes";

const BACKEND_PORT = process.env.BACKEND_PORT ?? 8001;

const app = express();

app.get("/health", healthRoute);

app.post("/api/v1/auth/guest", guestUserSignup);

const server = createServer(app);

const wss = new WebSocketServer({ server });

registerSocket(wss);

server.listen(BACKEND_PORT, () => {
  console.log(`server is running on port ${BACKEND_PORT}`);
});

export default app;
