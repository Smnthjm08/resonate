import "./env";

import cors from "cors";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { auth, toNodeHandler, WEB_ORIGIN } from "@repo/auth";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";
import { apiRouter } from "./routes";

const BACKEND_PORT = process.env.BACKEND_PORT ?? 8001;

const app = express();

// Credentials must be allowed for the browser to keep the session cookie.
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

// Better Auth reads the raw request body, so it has to be mounted before
// express.json() consumes the stream.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", healthRoute);

app.use("/api/v1", apiRouter);

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

registerSocket(wss, server);

server.listen(BACKEND_PORT, () => {
  console.log(`server is running on port ${BACKEND_PORT}`);
});

export default app;
