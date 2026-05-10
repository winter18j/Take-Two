import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  createRoom,
  drawUntilPlayable,
  handleDisconnect,
  joinRoom,
  playCard,
  resolvePending,
  startGame,
} from "./game/rooms.js";
import { Suit, suits } from "./game/types.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsPath = path.resolve(__dirname, "../../resources/cards");

app.use(cors());
app.use(express.json());
app.use("/cards", express.static(cardsPath));

app.get("/", (_request, response) => {
  response.json({
    name: "Spanish Card Game server",
    status: "running",
    app: "Open the Expo app at http://localhost:8081",
    health: "/health",
    cards: "/cards/<key>-<number>.png",
  });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

function handleSocketError(socketId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  io.to(socketId).emit("errorMessage", message);
}

function parseSuit(value: unknown): Suit | undefined {
  return suits.find((suit) => suit === value);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }: { name: string }) => {
    try {
      const { room, player } = createRoom(io, socket.id, name);
      socket.emit("session", { roomId: room.id, playerId: player.id });
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("joinRoom", ({ roomId, name }: { roomId: string; name: string }) => {
    try {
      const { room, player } = joinRoom(io, socket.id, roomId, name);
      socket.emit("session", { roomId: room.id, playerId: player.id });
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("startGame", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      startGame(io, roomId, playerId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on(
    "playCard",
    ({ roomId, playerId, cardId, chosenSuit }: { roomId: string; playerId: string; cardId: string; chosenSuit?: string }) => {
      try {
        playCard(io, roomId, playerId, cardId, parseSuit(chosenSuit));
      } catch (error) {
        handleSocketError(socket.id, error);
      }
    },
  );

  socket.on("drawUntilPlayable", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      drawUntilPlayable(io, roomId, playerId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("resolvePending", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      resolvePending(io, roomId, playerId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("disconnect", () => {
    handleDisconnect(io, socket.id);
  });
});

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  console.log(`Card game server running on http://localhost:${port}`);
  console.log(`Serving card images from ${cardsPath}`);
});
