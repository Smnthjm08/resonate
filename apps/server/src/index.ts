import "./env";

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";

const BACKEND_PORT = process.env.BACKEND_PORT ?? 8081;

const app = express();

app.get("/health", healthRoute);

const server = createServer(app);

const wss = new WebSocketServer({ server });

registerSocket(wss);

server.listen(BACKEND_PORT, () => {
  console.log(`server is running on port ${BACKEND_PORT}`);
});

export default app;
