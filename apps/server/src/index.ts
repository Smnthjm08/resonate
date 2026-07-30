import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { healthRoute } from "./route";
import { registerSocket } from "./sockets/socket";

const app = express();

app.get("/health", healthRoute);

const server = createServer(app);

const wss = new WebSocketServer({ server });

// wss.on("connection", (ws) => {
//   // close, error, message, open, ping, redirect, unexpected-response, upgrade
//   console.log("============== websocket ==============");

//   ws.on("open", () => {
//     console.log("Connected!");

//     ws.send(
//       JSON.stringify({
//         type: "ping",
//       }),
//     );
//   });

//   ws.on("message", (message) => {
//     console.log(message.toString());
//     const messagse = JSON.parse(message.toString());

//     if (messagse.type === "ping") {
//       ws.send(
//         JSON.stringify({
//           type: "pong",
//         }),
//       );
//     }
//   });

//   ws.on("close", () => {
//     console.log("Client disconnected");
//   });

//   ws.on("error", console.error);
// });

registerSocket(wss);

server.listen(8001, () => {
  console.log("server is running on port 8001!");
});

export default app;
