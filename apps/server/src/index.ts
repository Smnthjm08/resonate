import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK!",
  });
});

const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  // close, error, message, open, ping, redirect, unexpected-response, upgrade
  console.log("==============");

  ws.on("open", () => {
    console.log("connection open!");
  });

  ws.on("message", (message) => {
    console.log(message.toString());
  });

  // ws.on("")

  ws.on("close", () => {
    console.log("connection closed!");
  });
});

server.listen(8001, () => {
  console.log("server is running on port 8001!");
});
