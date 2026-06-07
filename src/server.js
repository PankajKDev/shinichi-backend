const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { clerkMiddleware } = require("./middlewares/clerkAuth");
const { redis } = require("./db/redis");

const app = express();
app.use(
  cors({
    origin: "*",
  }),
);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ORIGIN,
    methods: ["GET", "POST"],
  },
});
//middlewares
io.use(clerkMiddleware);

// connections

io.on("connection", (socket) => {
  console.log(`user connected :${socket.id}`);
  socket.on("JOIN_ROOM", ({ roomId }) => {
    if (roomId.trim() === "") return;
    socket.join(roomId);
    console.log(`${socket.id} joined ${roomId}`);
  });
  socket.on("SEND_MESSAGE", async (data) => {
    const secureMessage = {
      ...data,
      senderId: socket.userId,
    };

    const redisKey = `chat_history:${data.room}`;
    try {
      await redis.rpush(redisKey, JSON.stringify(secureMessage));
      await redis.ltrim(redisKey, -50, -1);
      await redis.expire(redisKey, 86400);
    } catch (e) {
      console.error("Failed to save messages");
    }
    io.to(data.room).emit("RECEIVE_MESSAGE", secureMessage);
  });
});

const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
  console.log(`server active at http://localhost:${PORT}`);
});
