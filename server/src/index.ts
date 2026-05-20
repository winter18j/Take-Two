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
  createMatchmakingRoom,
  drawUntilPlayable,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  playCard,
  resolvePending,
  restartRoom,
  returnToLobby,
  resumeSession,
  requireRoom,
  startGame,
} from "./game/rooms.js";
import { MatchmakingQueue } from "./game/matchmaking.js";
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
const matchmakingQueue = new MatchmakingQueue();
const persistedMatches = new Set<string>();
const devEmails = new Set(["walidsabhied@gmail.com", "houdasafi555@gmail.com"]);
const matchmakingEntryCost = 25;

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

async function getMatchmakingProfile(accountId: string) {
  if (!supabase) {
    return { hidden_score: 1000, random_banned_until: null as string | null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("hidden_score, random_banned_until")
    .eq("id", accountId)
    .single();

  if (error) {
    throw new Error("Could not load matchmaking profile.");
  }

  return data;
}

function isDevEmail(email: unknown) {
  return typeof email === "string" && devEmails.has(email.toLowerCase());
}

async function hasEnoughCoins(accountId: string, email: unknown, amount: number) {
  if (!supabase || isDevEmail(email)) {
    return true;
  }

  const { data, error } = await supabase
    .from("wallets")
    .select("coins")
    .eq("user_id", accountId)
    .single();

  if (error) {
    throw new Error("Could not load wallet.");
  }

  return (data?.coins ?? 0) >= amount;
}

async function spendMatchmakingCoins(accountId: string, email: unknown) {
  if (!supabase || isDevEmail(email)) {
    return true;
  }

  const { data, error } = await supabase.rpc("spend_coins", {
    user_uuid: accountId,
    amount: matchmakingEntryCost,
    reason_text: "random_matchmaking_entry",
    metadata_json: {},
  });

  if (error) {
    throw new Error("Could not spend matchmaking coins.");
  }

  return Boolean(data);
}

async function awardCoins(accountId: string, email: unknown, amount: number, reason: string) {
  if (!supabase || isDevEmail(email) || amount <= 0) {
    return;
  }

  await supabase.rpc("add_coins", {
    user_uuid: accountId,
    amount,
    reason_text: reason,
    metadata_json: {},
  });
}

function rewardForPlacement(playerCount: number, placement: number) {
  const rewards: Record<number, number[]> = {
    2: [40, 0],
    3: [45, 20, 10],
    4: [55, 30, 15, 0],
  };

  return rewards[playerCount]?.[placement] ?? 0;
}

async function tryStartMatchmakingRoom() {
  const match = matchmakingQueue.findMatch();
  if (!match) {
    return;
  }

  for (const entry of match.entries) {
    const socket = io.sockets.sockets.get(entry.socketId);
    const ok = await spendMatchmakingCoins(entry.accountId, socket?.data.email);
    if (!ok) {
      io.to(entry.socketId).emit("matchmakingStatus", { queued: false });
      io.to(entry.socketId).emit("errorMessage", "You need 25 coins to play random.");
      return;
    }
  }

  const { room, players } = createMatchmakingRoom(io, match.entries, match.botCount);
  players.forEach((player) => {
    if (player.isBot) {
      return;
    }
    io.to(player.socketId).emit("session", { roomId: room.id, playerId: player.id });
    io.to(player.socketId).emit("matchmakingStatus", { queued: false });
  });
}

setInterval(() => {
  void tryStartMatchmakingRoom();
}, 1000).unref?.();

async function persistFinishedMatch(roomId: string) {
  if (!supabase || persistedMatches.has(roomId)) {
    return;
  }

  const room = requireRoom(roomId);
  if (room.status !== "finished") {
    return;
  }

  persistedMatches.add(room.id);
  const ranked = room.roundResults
    .map((id) => room.players.find((player) => player.id === id))
    .filter((player) => Boolean(player?.accountId));

  await supabase.from("matches").insert({
    room_code: room.id,
    player_count: room.players.length,
    winner_id: room.players.find((player) => player.id === room.winnerId)?.accountId ?? null,
    loser_id: room.players.find((player) => player.id === room.loserId)?.accountId ?? null,
    results: ranked.map((player, index) => ({ accountId: player?.accountId, placement: index + 1 })),
    finished_at: new Date().toISOString(),
  });

  for (const player of ranked) {
    if (!player?.accountId) {
      continue;
    }
    const placement = room.roundResults.indexOf(player.id);
    const delta = (ranked.length - 1 - placement) * 12 - placement * 12 + (placement === 0 ? 8 : 0);
    await supabase.rpc("record_match_result", {
      user_uuid: player.accountId,
      placement_delta: delta,
      did_win: player.id === room.winnerId,
      did_lose: player.id === room.loserId,
    });
    if (room.isMatchmaking) {
      await awardCoins(
        player.accountId,
        player.socketId ? io.sockets.sockets.get(player.socketId)?.data.email : null,
        rewardForPlacement(room.players.length, placement),
        "random_match_reward",
      );
    }
  }
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
    if (supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wins")
        .eq("id", data.user.id)
        .maybeSingle();
      socket.data.accountWins = profile?.wins ?? 0;
    }
  }
  next();
});

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }: { name: string }) => {
    try {
      const { room, player } = createRoom(io, socket.id, name, socket.data.accountId, socket.data.accountWins);
      socket.emit("session", { roomId: room.id, playerId: player.id });
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("joinRoom", ({ roomId, name }: { roomId: string; name: string }) => {
    try {
      const { room, player } = joinRoom(io, socket.id, roomId, name, socket.data.accountId, socket.data.accountWins);
      socket.emit("session", { roomId: room.id, playerId: player.id });
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("joinMatchmaking", async ({ name }: { name: string }) => {
    try {
      const accountId = socket.data.accountId;
      if (!accountId) {
        throw new Error("Sign in to play random matchmaking.");
      }

      const profile = await getMatchmakingProfile(accountId);
      if (profile.random_banned_until && new Date(profile.random_banned_until).getTime() > Date.now()) {
        throw new Error("Random play is temporarily locked because of recent quits.");
      }
      if (!(await hasEnoughCoins(accountId, socket.data.email, matchmakingEntryCost))) {
        throw new Error("You need 25 coins to play random.");
      }

      matchmakingQueue.add({
        accountId,
        hiddenScore: profile.hidden_score ?? 1000,
        joinedAt: Date.now(),
        name: name?.trim() || socket.data.email?.split("@")[0] || "Player",
        socketId: socket.id,
      });
      const status = matchmakingQueue.status(socket.id);
      socket.emit("matchmakingStatus", {
        ...status,
        etaSeconds: matchmakingQueue.size() >= 4 ? 2 : 10,
      });
      void tryStartMatchmakingRoom();
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("cancelMatchmaking", () => {
    matchmakingQueue.removeSocket(socket.id);
    socket.emit("matchmakingStatus", { queued: false });
  });

  socket.on("resumeSession", ({ roomId, playerId, name }: { roomId: string; playerId: string; name?: string }) => {
    try {
      const { room, player } = resumeSession(io, socket.id, roomId, playerId, name);
      socket.emit("session", { roomId: room.id, playerId: player.id });
    } catch (error) {
      socket.emit("session", null);
      handleSocketError(socket.id, error);
    }
  });

  socket.on("startGame", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      startGame(io, roomId, playerId);
      void persistFinishedMatch(roomId);
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

  socket.on("returnToLobby", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      returnToLobby(io, roomId, playerId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("leaveRoom", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      leaveRoom(io, roomId, playerId);
      void persistFinishedMatch(roomId);
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
        void persistFinishedMatch(roomId);
      } catch (error) {
        handleSocketError(socket.id, error);
      }
    },
  );

  socket.on("drawUntilPlayable", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      drawUntilPlayable(io, roomId, playerId);
      void persistFinishedMatch(roomId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("resolvePending", ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    try {
      resolvePending(io, roomId, playerId);
      void persistFinishedMatch(roomId);
    } catch (error) {
      handleSocketError(socket.id, error);
    }
  });

  socket.on("disconnect", () => {
    matchmakingQueue.removeSocket(socket.id);
    handleDisconnect(io, socket.id);
  });
});

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  console.log(`Card game server running on http://localhost:${port}`);
  console.log(`Serving card images from ${cardsPath}`);
});
