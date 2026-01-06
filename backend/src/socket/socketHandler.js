import { nanoid } from "nanoid";
import redis from "../utils/redis.js";

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // CREATE ROOM
    socket.on("create-room", async ({ username }, callback) => {
      const roomId = nanoid(8);

      const user = {
        socketId: socket.id,
        username,
      };

      await redis.hset(`room:${roomId}:users`, socket.id, JSON.stringify(user));
      await redis.set(`room:${roomId}:code`, "");

      socket.join(roomId);

      callback({ roomId });
    });

    // JOIN ROOM
    socket.on("join-room", async ({ roomId, username }, callback) => {
      const roomExists = await redis.exists(`room:${roomId}:users`);

      if (!roomExists) {
        return callback({ error: "Room does not exist" });
      }

      const user = {
        socketId: socket.id,
        username,
      };

      await redis.hset(`room:${roomId}:users`, socket.id, JSON.stringify(user));
      socket.join(roomId);

      callback({ success: true });
    });

    // SEND EXISTING CODE TO NEW USER
    socket.on("get-code", async ({ roomId }, callback) => {
      const code = await redis.get(`room:${roomId}:code`);
      callback({ code: code || "" });
    });

    // CODE CHANGE EVENT
    socket.on("code-change", async ({ roomId, code }) => {
      await redis.set(`room:${roomId}:code`, code);
      socket.to(roomId).emit("code-update", { code });
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
}
