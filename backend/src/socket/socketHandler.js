import { nanoid } from "nanoid";
import redis from "../utils/redis.js";

// helper function to send updated user list to room
async function sendUsersInRoom(io, roomId) {
  const users = await redis.hgetall(`room:${roomId}:users`);
  const userList = Object.values(users).map((u) => JSON.parse(u));
  io.to(roomId).emit("users-update", userList);
}

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // track which room this socket belongs to
    socket.currentRoom = null;

    // ================= CREATE ROOM =================
    socket.on("create-room", async ({ username }, callback) => {
      const roomId = nanoid(8);

      const user = {
        socketId: socket.id,
        username,
      };

      // store user & initial code in redis
      await redis.hset(`room:${roomId}:users`, socket.id, JSON.stringify(user));
      await redis.set(`room:${roomId}:code`, "");

      socket.join(roomId);
      socket.currentRoom = roomId;

      // send updated user list
      await sendUsersInRoom(io, roomId);

      callback({ roomId });
    });

    // ================= JOIN ROOM =================
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
      socket.currentRoom = roomId;

      // send updated user list
      await sendUsersInRoom(io, roomId);

      callback({ success: true });
    });

    // ================= SEND LATEST CODE =================
    socket.on("get-code", async ({ roomId }, callback) => {
      const code = await redis.get(`room:${roomId}:code`);
      callback({ code: code || "" });
    });

    // ================= CODE CHANGE =================
    socket.on("code-change", async ({ roomId, code }) => {
      // save latest code
      await redis.set(`room:${roomId}:code`, code);

      // broadcast to other users
      socket.to(roomId).emit("code-update", { code });
    });

    // ================= DISCONNECT =================
    socket.on("disconnect", async () => {
      const roomId = socket.currentRoom;

      if (roomId) {
        await redis.hdel(`room:${roomId}:users`, socket.id);
        await sendUsersInRoom(io, roomId);
      }

      console.log("Socket disconnected:", socket.id);
    });
  });
}
