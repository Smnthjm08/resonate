import "./env";

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { auth } from "@repo/auth";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";
import { apiRouter } from "./routes";

const BACKEND_PORT = process.env.BACKEND_PORT ?? 8001;

const app = express();

app.all("/api/auth/*splat", async (req, res) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value)
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const request = new Request(
    `${process.env.BETTER_AUTH_URL ?? `http://localhost:${BACKEND_PORT}`}${req.originalUrl}`,
    {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : (req as unknown as ReadableStream<Uint8Array>),
    },
  );
  const response = await auth.handler(request);

  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.status(response.status).send(await response.text());
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", healthRoute);

app.use("/api/v1", apiRouter);

const server = createServer(app);

const wss = new WebSocketServer({ server });

registerSocket(wss);

server.listen(BACKEND_PORT, () => {
  console.log(`server is running on port ${BACKEND_PORT}`);
});

export default app;
