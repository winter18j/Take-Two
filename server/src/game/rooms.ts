import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { createDeck, drawCards, shuffle } from "./deck.js";
import {
  Card,
  ClientGameState,
  PendingAction,
  Player,
  RESPONSE_WINDOW_MS,
  Room,
  Suit,
} from "./types.js";

const rooms = new Map<string, Room>();

function roomCode(): string {
  let code = "";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let index = 0; index < 5; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return rooms.has(code) ? roomCode() : code;
}

function getCurrentPlayer(room: Room) {
  return room.players[room.currentPlayerIndex] ?? null;
}

function getNextIndex(room: Room, fromIndex = room.currentPlayerIndex) {
  return (fromIndex + 1) % room.players.length;
}

function publicPlayers(room: Room) {
  return room.players.map((player) => ({
    id: player.id,
    name: player.name,
    handCount: player.hand.length,
    isHost: player.isHost,
    isConnected: player.isConnected,
  }));
}

function toClientState(room: Room, player: Player): ClientGameState {
  return {
    roomId: room.id,
    status: room.status,
    players: publicPlayers(room),
    hand: player.hand,
    deckCount: room.deck.length,
    discardCount: room.discard.length,
    middleCard: room.middleCard,
    currentPlayerId: getCurrentPlayer(room)?.id ?? null,
    chosenSuit: room.chosenSuit,
    pendingAction: room.pendingAction,
    canDraw: canDrawCard(room, player),
    winnerId: room.winnerId,
    message: room.message,
    youAreHost: player.isHost,
  };
}

function emitRoom(io: Server, room: Room) {
  for (const player of room.players) {
    io.to(player.socketId).emit("gameState", toClientState(room, player));
  }
}

function clearTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function drawFromDeck(room: Room, count: number) {
  if (room.deck.length < count && room.discard.length > 1 && room.middleCard) {
    const recycled = room.discard.filter((card) => card.id !== room.middleCard?.id);
    room.discard = [room.middleCard];
    room.deck = shuffle(recycled);
  }

  return drawCards(room.deck, Math.min(count, room.deck.length));
}

function canPlay(card: Card, room: Room, player: Player) {
  if (room.status !== "playing" || room.winnerId) {
    return false;
  }

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== player.id) {
    return false;
  }

  if (room.pendingAction) {
    if (room.pendingAction.targetPlayerId !== player.id) {
      return false;
    }

    return room.pendingAction.type === "skip" ? card.rank === 1 : card.rank === 2;
  }

  if (!room.middleCard) {
    return true;
  }

  if (room.chosenSuit) {
    return card.suit === room.chosenSuit || card.rank === 7;
  }

  return card.suit === room.middleCard.suit || card.rank === room.middleCard.rank;
}

function findPlayable(player: Player, room: Room) {
  return player.hand.find((card) => canPlay(card, room, player));
}

function canDrawCard(room: Room, player: Player) {
  if (room.status !== "playing" || room.winnerId) {
    return false;
  }

  if (room.pendingAction || getCurrentPlayer(room)?.id !== player.id) {
    return false;
  }

  return room.deck.length > 0 || room.discard.length > 1;
}

function setPending(io: Server, room: Room, pendingAction: PendingAction) {
  clearTimer(room);
  room.pendingAction = pendingAction;
  room.currentPlayerIndex = room.players.findIndex((player) => player.id === pendingAction.targetPlayerId);

  room.timer = setTimeout(() => {
    resolvePending(io, room.id);
  }, Math.max(0, pendingAction.expiresAt - Date.now()));
}

function moveToNext(room: Room, fromIndex = room.currentPlayerIndex) {
  room.currentPlayerIndex = getNextIndex(room, fromIndex);
}

function applyPlayedCard(io: Server, room: Room, player: Player, card: Card, chosenSuit?: Suit) {
  const cardIndex = player.hand.findIndex((heldCard) => heldCard.id === card.id);
  if (cardIndex < 0 || !canPlay(card, room, player)) {
    return false;
  }

  const [playedCard] = player.hand.splice(cardIndex, 1);
  room.middleCard = playedCard;
  room.discard.push(playedCard);
  clearTimer(room);

  if (player.hand.length === 0) {
    room.status = "finished";
    room.winnerId = player.id;
    room.pendingAction = null;
    room.message = `${player.name} won the game.`;
    return true;
  }

  const previousPending = room.pendingAction;
  room.pendingAction = null;
  room.chosenSuit = playedCard.rank === 7 ? chosenSuit ?? playedCard.suit : null;

  if (playedCard.rank === 1) {
    const target = room.players[getNextIndex(room)];
    setPending(io, room, {
      type: "skip",
      targetPlayerId: target.id,
      expiresAt: Date.now() + RESPONSE_WINDOW_MS,
    });
    room.message = `${target.name} has 10 seconds to answer with a 1.`;
    return true;
  }

  if (playedCard.rank === 2) {
    const target = room.players[getNextIndex(room)];
    setPending(io, room, {
      type: "draw",
      targetPlayerId: target.id,
      amount: (previousPending?.type === "draw" ? previousPending.amount : 0) + 2,
      expiresAt: Date.now() + RESPONSE_WINDOW_MS,
    });
    room.message = `${target.name} has 10 seconds to stack a 2.`;
    return true;
  }

  moveToNext(room);
  room.message = `${player.name} played ${playedCard.imageKey}.`;
  return true;
}

export function createRoom(io: Server, socketId: string, name: string) {
  const room: Room = {
    id: roomCode(),
    status: "lobby",
    players: [],
    deck: [],
    discard: [],
    middleCard: null,
    currentPlayerIndex: 0,
    chosenSuit: null,
    pendingAction: null,
    winnerId: null,
    message: "Waiting for players.",
    timer: null,
  };

  const player = addPlayerToRoom(room, socketId, name, true);
  rooms.set(room.id, room);
  io.sockets.sockets.get(socketId)?.join(room.id);
  emitRoom(io, room);
  return { room, player };
}

export function addPlayerToRoom(room: Room, socketId: string, name: string, isHost = false) {
  const player: Player = {
    id: randomUUID(),
    socketId,
    name: name.trim() || "Player",
    hand: [],
    handCount: 0,
    isHost,
    isConnected: true,
  };

  room.players.push(player);
  return player;
}

export function joinRoom(io: Server, socketId: string, roomId: string, name: string) {
  const room = rooms.get(roomId.toUpperCase());

  if (!room) {
    throw new Error("Room not found.");
  }

  if (room.status !== "lobby") {
    throw new Error("This room already started.");
  }

  if (room.players.length >= 4) {
    throw new Error("This room already has 4 players.");
  }

  const player = addPlayerToRoom(room, socketId, name);
  io.sockets.sockets.get(socketId)?.join(room.id);
  room.message = `${player.name} joined.`;
  emitRoom(io, room);
  return { room, player };
}

export function startGame(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const host = room.players.find((player) => player.id === playerId);

  if (!host?.isHost) {
    throw new Error("Only the host can start the game.");
  }

  if (room.players.length < 2) {
    throw new Error("You need at least 2 players.");
  }

  room.deck = shuffle(createDeck());
  room.discard = [];
  room.players.forEach((player) => {
    player.hand = drawFromDeck(room, 4);
  });

  const [middleCard] = drawFromDeck(room, 1);
  room.middleCard = middleCard;
  room.discard = [middleCard];
  room.status = "playing";
  room.currentPlayerIndex = 0;
  room.pendingAction = null;
  room.chosenSuit = middleCard.rank === 7 ? middleCard.suit : null;
  room.winnerId = null;
  room.message = "Game started.";
  emitRoom(io, room);
}

export function playCard(io: Server, roomId: string, playerId: string, cardId: string, chosenSuit?: Suit) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);
  const card = player.hand.find((heldCard) => heldCard.id === cardId);

  if (!card) {
    throw new Error("Card not found in your hand.");
  }

  if (card.rank === 7 && !chosenSuit) {
    throw new Error("Choose a suit before playing 7.");
  }

  if (!applyPlayedCard(io, room, player, card, chosenSuit)) {
    throw new Error("You cannot play that card now.");
  }

  emitRoom(io, room);
}

export function drawUntilPlayable(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);

  if (room.pendingAction) {
    throw new Error("Resolve the timed action first.");
  }

  if (getCurrentPlayer(room)?.id !== player.id) {
    throw new Error("It is not your turn.");
  }

  if (!canDrawCard(room, player)) {
    throw new Error("You cannot draw again this turn.");
  }

  const [card] = drawFromDeck(room, 1);

  if (!card) {
    room.message = "No cards left to draw.";
    emitRoom(io, room);
    return;
  }

  player.hand.push(card);
  room.message = `${player.name} drew 1 card.`;
  moveToNext(room);
  emitRoom(io, room);
}

export function resolvePending(io: Server, roomId: string, playerId?: string) {
  const room = requireRoom(roomId);
  const pending = room.pendingAction;

  if (!pending) {
    return;
  }

  if (playerId && pending.targetPlayerId !== playerId) {
    throw new Error("This timed action is not yours.");
  }

  const targetIndex = room.players.findIndex((player) => player.id === pending.targetPlayerId);
  const target = room.players[targetIndex];
  clearTimer(room);
  room.pendingAction = null;

  if (pending.type === "draw") {
    const drawn = drawFromDeck(room, pending.amount);
    target.hand.push(...drawn);
    room.message = `${target.name} drew ${drawn.length} card(s) and lost the turn.`;
  } else {
    room.message = `${target.name} lost the turn.`;
  }

  moveToNext(room, targetIndex);
  emitRoom(io, room);
}

export function handleDisconnect(io: Server, socketId: string) {
  for (const room of rooms.values()) {
    const player = room.players.find((candidate) => candidate.socketId === socketId);

    if (player) {
      player.isConnected = false;
      room.message = `${player.name} disconnected.`;
      emitRoom(io, room);
      return;
    }
  }
}

export function requireRoom(roomId: string) {
  const room = rooms.get(roomId.toUpperCase());

  if (!room) {
    throw new Error("Room not found.");
  }

  return room;
}

function requirePlayer(room: Room, playerId: string) {
  const player = room.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error("Player not found.");
  }

  return player;
}
