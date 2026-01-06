import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import app from "./app.js";
import redis from "./utils/redis.js";
import socketHandler from "./socket/socketHandler.js";

dotenv.config();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

socketHandler(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
