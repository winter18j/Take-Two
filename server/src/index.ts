import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import {
  createRoom,
  drawUntilPlayable,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  playCard,
  resolvePending,
  restartRoom,
  startGame,
} from "./game/rooms.js";
import { Suit, suits } from "./game/types.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "*",
  },
});
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabase = supabaseUrl.includes("supabase.co") && !supabaseUrl.includes("YOUR_PROJECT_REF") && supabaseServiceRoleKey && !supabaseServiceRoleKey.includes("YOUR_")
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsPath = path.resolve(__dirname, "../../resources/cards");

app.use(cors());
app.use(express.json());
app.use("/cards", express.static(cardsPath));

app.get("/", (_request, response) => {
  response.json({
    name: "Take Two server",
    status: "running",
    app: "Open the Expo app at http://localhost:8081",
    health: "/health",
    cards: "/cards/<key>-<number>.png",
  });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true, supabase: Boolean(supabase) });
});

function handleSocketError(socketId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  io.to(socketId).emit("errorMessage", message);
}

function parseSuit(value: unknown): Suit | undefined {
  return suits.find((suit) => suit === value);
}

io.use(async (socket, next) => {
  const accessToken = socket.handshake.auth?.accessToken;
  if (!supabase || typeof accessToken !== "string" || accessToken.length === 0) {
    next();
    return;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (!error && data.user) {
    socket.data.accountId = data.user.id;
    socket.data.email = data.user.email;
  }
  next();
});

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

  socket.on("restartRoom", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      restartRoom(io, roomId, playerId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("leaveRoom", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      leaveRoom(io, roomId, playerId);
      socket.leave(roomId);
      socket.emit("session", null);
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
