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

  //VIDEOS
  socket.on("REQUEST_STATE", async ({ roomId }) => {
    const raw = await redis.get(getStateKey(roomId));
    if (raw) {
      socket.emit("ROOM_STATE", JSON.parse(raw));
    }
  });
  socket.on("PAUSE_VIDEO", async ({ room, time }) => {
    console.log("pause");
    await redis.set(
      getStateKey(room),
      JSON.stringify({ isPlaying: false, time }),
    );
    socket.to(room).emit("RECEIVE_PAUSE");
  });
  socket.on("PLAY_VIDEO", async ({ room, time }) => {
    console.log("play");
    await redis.set(
      getStateKey(room),
      JSON.stringify({ isPlaying: true, time }),
    );
    socket.to(room).emit("RECEIVE_PLAY");
  });
  socket.on("SEEK_VIDEO", async ({ room, time }) => {
    console.log("seek", time);
    const raw = await redis.get(getStateKey(room));
    const prev = raw ? JSON.parse(raw) : { isPlaying: false };
    await redis.set(getStateKey(room), JSON.stringify({ ...prev, time }));
    socket.to(room).emit("RECEIVE_SEEK", { time });
  });

  //MESSAGES
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
