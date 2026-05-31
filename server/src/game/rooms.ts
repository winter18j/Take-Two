import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { createDeck, drawCards, shuffle } from "./deck.js";
import { defaultMatchmakingTable, getMatchmakingTable, MatchmakingTableId } from "./tables.js";
import {
  Card,
  ClientGameState,
  PendingAction,
  Player,
  RESPONSE_WINDOW_MS,
  Room,
  RoomRules,
  Suit,
  TURN_WINDOW_MS,
} from "./types.js";

const rooms = new Map<string, Room>();
const defaultRules: RoomRules = {
  assistedPlay: true,
  chooseDrawCards: false,
  manualCall: false,
  modifierCards: false,
  skipOwnTurnCard: false,
};
const matchmakingRules: RoomRules = {
  assistedPlay: true,
  chooseDrawCards: true,
  manualCall: false,
  modifierCards: true,
  skipOwnTurnCard: true,
};
const skipAbilityUseLimit = 2;

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

function hasFinished(room: Room, player: Player) {
  return room.roundResults.includes(player.id);
}

function activePlayers(room: Room) {
  return room.players.filter((player) => player.isConnected && !hasFinished(room, player));
}

function assignNextHost(room: Room) {
  const nextHost = room.players.find((player) => player.isConnected) ?? room.players[0] ?? null;
  room.players.forEach((player) => {
    player.isHost = player.id === nextHost?.id;
  });
}

function getNextActiveIndex(room: Room, fromIndex = room.currentPlayerIndex) {
  if (room.players.length === 0) {
    return 0;
  }

  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const index = (fromIndex + offset) % room.players.length;
    const player = room.players[index];
    if (player?.isConnected && !hasFinished(room, player)) {
      return index;
    }
  }

  return fromIndex;
}

function visibleHandCount(room: Room, player: Player) {
  if (hasFinished(room, player)) {
    return 0;
  }

  return player.hand.filter((card) => card.type !== "modifier").length;
}

function publicPlayers(room: Room) {
  return room.players.map((player) => ({
    id: player.id,
    accountId: player.accountId,
    accountWins: player.accountWins,
    isBot: player.isBot,
    name: player.name,
    handCount: visibleHandCount(room, player),
    isHost: player.isHost,
    isConnected: player.isConnected,
    placement: room.roundResults.indexOf(player.id) >= 0
      ? room.roundResults.indexOf(player.id) + 1
      : null,
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
    lastPlayAttempt: room.rules.manualCall ? room.lastPlayAttempt : null,
    currentPlayerId: getCurrentPlayer(room)?.id ?? null,
    chosenSuit: room.chosenSuit,
    activeModifier: room.activeModifier,
    skipAbilityUsesRemaining: room.activeModifier?.modifier === "skip_ability"
      ? Math.max(0, skipAbilityUseLimit - (room.skipAbilityUses[player.id] ?? 0))
      : 0,
    drawChoice: room.drawChoice?.playerId === player.id ? room.drawChoice : null,
    pendingAction: room.pendingAction,
    turnExpiresAt: room.pendingAction?.expiresAt ?? room.turnExpiresAt,
    canDraw: canDrawCard(room, player),
    winnerId: room.winnerId,
    loserId: room.loserId,
    roundResults: room.roundResults,
    rematchRequests: room.rematchRequests,
    scores: room.scores,
    message: room.message,
    isMatchmaking: Boolean(room.isMatchmaking),
    matchmakingEntryFee: room.matchmakingEntryFee,
    matchmakingTableId: room.matchmakingTableId,
    matchmakingTableName: room.matchmakingTableName,
    rules: room.rules,
    youAreHost: player.isHost,
  };
}

function emitRoom(io: Server, room: Room) {
  for (const player of room.players) {
    if (player.isBot) {
      continue;
    }
    io.to(player.socketId).emit("gameState", toClientState(room, player));
  }
}

function clearTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function isActionRank(card: Card) {
  return card.type !== "playing" || card.rank === 1 || card.rank === 2 || card.rank === 7;
}

function drawFromDeck(room: Room, count: number) {
  if (room.deck.length < count && room.discard.length > 1 && room.middleCard) {
    const recycled = room.discard.filter((card) => card.id !== room.middleCard?.id && card.type !== "modifier");
    room.discard = [room.middleCard];
    room.deck = shuffle(recycled);
  }

  return drawCards(room.deck, Math.min(count, room.deck.length));
}

function drawPenaltyAmount(room: Room, baseAmount: number) {
  if (room.activeModifier?.modifier === "draw_one_half") {
    return Math.ceil(baseAmount * 1.5);
  }
  if (room.activeModifier?.modifier === "draw_half") {
    return Math.max(1, Math.ceil(baseAmount * 0.5));
  }
  return baseAmount;
}

function turnWindowMs(room: Room) {
  return room.activeModifier?.modifier === "timer_five" ? 5_000 : TURN_WINDOW_MS;
}

function pendingWindowMs(room: Room) {
  return room.activeModifier?.modifier === "timer_five" ? 5_000 : RESPONSE_WINDOW_MS;
}

function drawChoiceWindowMs(room: Room) {
  return room.activeModifier?.modifier === "timer_five" ? 3_000 : RESPONSE_WINDOW_MS;
}

function modifierLabel(modifier: Card["modifier"]) {
  const labels: Record<string, string> = {
    choose_three: "Choose 3",
    draw_half: "0.5x draw",
    draw_one_half: "1.5x draw",
    skip_ability: "skip ability",
    timer_five: "5s timer",
  };
  return modifier ? labels[modifier] ?? modifier : "modifier";
}

function drawStartingCard(room: Room) {
  const delayedActionCards: Card[] = [];

  while (room.deck.length > 0) {
    const [candidate] = drawFromDeck(room, 1);
    if (!candidate) {
      break;
    }

    if (!isActionRank(candidate)) {
      if (delayedActionCards.length > 0) {
        room.deck.push(...shuffle(delayedActionCards));
      }
      return candidate;
    }

    delayedActionCards.push(candidate);
  }

  room.deck.push(...shuffle(delayedActionCards));
  const [fallback] = drawFromDeck(room, 1);
  return fallback ?? null;
}

function canPlay(card: Card, room: Room, player: Player) {
  if (room.status !== "playing" || hasFinished(room, player)) {
    return false;
  }

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== player.id) {
    return false;
  }

  if (room.drawChoice) {
    return false;
  }

  if (card.type === "skip_turn") {
    return Boolean(room.rules.skipOwnTurnCard);
  }

  if (card.type === "modifier") {
    return Boolean(room.rules.modifierCards && !room.modifierPlayedThisTurn);
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

function isLegalManualPlay(card: Card, room: Room) {
  const previousMiddle = room.middleCard;
  const previousChosenSuit = room.chosenSuit;
  const previousPending = room.pendingAction;

  if (card.type !== "playing") {
    return false;
  }
  if (!previousMiddle) {
    return true;
  }
  if (previousPending) {
    return previousPending.type === "draw" ? card.rank === 2 : card.rank === 1;
  }
  if (previousChosenSuit) {
    return card.suit === previousChosenSuit || card.rank === 7;
  }

  return card.suit === previousMiddle.suit || card.rank === previousMiddle.rank;
}

function findPlayable(player: Player, room: Room) {
  return player.hand.find((card) => canPlay(card, room, player));
}

function canDrawCard(room: Room, player: Player) {
  if (room.status !== "playing" || hasFinished(room, player)) {
    return false;
  }

  if (room.pendingAction || room.drawChoice || getCurrentPlayer(room)?.id !== player.id) {
    return false;
  }

  return room.deck.length > 0 || room.discard.length > 1;
}

function setPending(io: Server, room: Room, pendingAction: PendingAction) {
  clearTimer(room);
  room.pendingAction = pendingAction;
  room.turnExpiresAt = null;
  room.currentPlayerIndex = room.players.findIndex((player) => player.id === pendingAction.targetPlayerId);
  room.modifierPlayedThisTurn = false;

  room.timer = setTimeout(() => {
    resolvePending(io, room.id);
  }, Math.max(0, pendingAction.expiresAt - Date.now()));
  room.timer.unref?.();
}

function scheduleTurnTimer(io: Server, room: Room) {
  clearTimer(room);
  if (room.status !== "playing" || room.pendingAction || activePlayers(room).length <= 1) {
    room.turnExpiresAt = null;
    return;
  }

  const windowMs = turnWindowMs(room);
  room.turnExpiresAt = Date.now() + windowMs;
  room.timer = setTimeout(() => {
    resolveTurnTimeout(io, room.id);
  }, windowMs);
  room.timer.unref?.();
}

function moveToNext(room: Room, fromIndex = room.currentPlayerIndex) {
  room.currentPlayerIndex = getNextActiveIndex(room, fromIndex);
  room.modifierPlayedThisTurn = false;
}

function setActiveModifier(room: Room, modifier: Card | null) {
  room.activeModifier = modifier;
  room.skipAbilityUses = {};
}

function returnLeftoverModifiersToDeck(room: Room, player: Player) {
  const modifiers = player.hand.filter((card) => card.type === "modifier");
  if (modifiers.length === 0) {
    return;
  }

  player.hand = player.hand.filter((card) => card.type !== "modifier");
  room.deck = shuffle([...room.deck, ...modifiers]);
}

export function randomizePlayerOrderForRound(room: Room, random = Math.random) {
  const players = [...room.players];

  for (let index = players.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [players[index], players[swapIndex]] = [players[swapIndex], players[index]];
  }

  room.players = players;
  room.currentPlayerIndex = 0;
}

function finishPlayerIfNeeded(room: Room, player: Player) {
  const remainingRoundCards = player.hand.filter((card) => card.type !== "modifier");
  if (remainingRoundCards.length > 0 || hasFinished(room, player)) {
    return false;
  }

  returnLeftoverModifiersToDeck(room, player);
  room.roundResults.push(player.id);
  if (room.roundResults.length === 1) {
    room.winnerId = player.id;
    room.scores[player.id] = (room.scores[player.id] ?? 0) + 1;
  }
  return true;
}

function finishRoundIfNeeded(room: Room) {
  const remaining = activePlayers(room);
  if (remaining.length > 1) {
    return false;
  }

  const loser = remaining[0] ?? null;
  if (loser && !room.roundResults.includes(loser.id)) {
    room.roundResults.push(loser.id);
  }

  room.status = "finished";
  room.pendingAction = null;
  room.turnExpiresAt = null;
  room.loserId = loser?.id ?? null;
  const winner = room.players.find((player) => player.id === room.winnerId);
  room.message = loser
    ? `${loser.name} is the final loser. ${winner?.name ?? "Someone"} won the round.`
    : "Round finished.";
  return true;
}

function finishRoundByForfeit(room: Room, forfeitingPlayer: Player) {
  const winner = activePlayers(room)[0] ?? room.players.find((player) => player.id !== forfeitingPlayer.id) ?? null;
  if (winner && !room.roundResults.includes(winner.id)) {
    room.roundResults.unshift(winner.id);
  }
  if (!room.roundResults.includes(forfeitingPlayer.id)) {
    room.roundResults.push(forfeitingPlayer.id);
  }

  room.status = "finished";
  room.pendingAction = null;
  room.turnExpiresAt = null;
  room.winnerId = winner?.id ?? room.winnerId;
  room.loserId = forfeitingPlayer.id;
  if (winner) {
    room.scores[winner.id] = (room.scores[winner.id] ?? 0) + 1;
  }
  room.message = `${forfeitingPlayer.name} left. ${winner?.name ?? "The remaining player"} wins.`;
}

function applyPlayedCard(io: Server, room: Room, player: Player, card: Card, chosenSuit?: Suit) {
  const cardIndex = player.hand.findIndex((heldCard) => heldCard.id === card.id);
  const manualPlay = room.rules.manualCall && card.type === "playing";
  const legalManualPlay = manualPlay ? isLegalManualPlay(card, room) : true;
  if (cardIndex < 0 || (!manualPlay && !canPlay(card, room, player))) {
    return false;
  }

  const [playedCard] = player.hand.splice(cardIndex, 1);
  room.lastPlayAttempt = null;

  if (playedCard.type === "modifier") {
    setActiveModifier(room, playedCard);
    room.modifierPlayedThisTurn = true;
    room.message = `${player.name} played ${modifierLabel(playedCard.modifier)} modifier.`;
    if (finishPlayerIfNeeded(room, player)) {
      if (finishRoundIfNeeded(room)) {
        clearTimer(room);
        return true;
      }
      moveToNext(room);
      scheduleTurnTimer(io, room);
    }
    return true;
  }

  if (playedCard.type === "skip_turn") {
    const previousPending = room.pendingAction;
    room.discard.push(playedCard);
    clearTimer(room);
    room.pendingAction = null;
    room.drawChoice = null;
    if (previousPending?.targetPlayerId === player.id) {
      const target = room.players[getNextActiveIndex(room)];
      setPending(io, room, {
        ...previousPending,
        targetPlayerId: target.id,
        expiresAt: Date.now() + pendingWindowMs(room),
      });
      room.message = `${player.name} passed the penalty to ${target.name}.`;
      if (finishPlayerIfNeeded(room, player) && finishRoundIfNeeded(room)) {
        clearTimer(room);
      }
    } else {
      if (finishPlayerIfNeeded(room, player)) {
        if (finishRoundIfNeeded(room)) {
          clearTimer(room);
          return true;
        }
        moveToNext(room);
        scheduleTurnTimer(io, room);
        room.message = `${player.name} finished and secured place ${room.roundResults.length}.`;
        return true;
      }
      moveToNext(room);
      scheduleTurnTimer(io, room);
      room.message = `${player.name} skipped their turn.`;
    }
    return true;
  }

  room.middleCard = playedCard;
  if (manualPlay) {
    room.lastPlayAttempt = {
      callerIds: [],
      cardId: playedCard.id,
      isLegal: legalManualPlay,
      playerId: player.id,
    };
  }
  room.discard.push(playedCard);
  clearTimer(room);

  const previousPending = room.pendingAction;
  room.pendingAction = null;
  room.chosenSuit = playedCard.rank === 7 ? chosenSuit ?? playedCard.suit : null;

  if (playedCard.rank === 1) {
    const target = room.players[getNextActiveIndex(room)];
    setPending(io, room, {
      type: "skip",
      targetPlayerId: target.id,
      expiresAt: Date.now() + pendingWindowMs(room),
    });
    room.message = `${target.name} has 10 seconds to answer with a 1.`;
    if (finishPlayerIfNeeded(room, player) && finishRoundIfNeeded(room)) {
      clearTimer(room);
      room.message = `${player.name} finished first. ${room.message}`;
    }
    return true;
  }

  if (playedCard.rank === 2) {
    const target = room.players[getNextActiveIndex(room)];
    setPending(io, room, {
      type: "draw",
      targetPlayerId: target.id,
      amount: (previousPending?.type === "draw" ? previousPending.amount : 0) + drawPenaltyAmount(room, 2),
      expiresAt: Date.now() + pendingWindowMs(room),
    });
    room.message = `${target.name} has 10 seconds to stack a 2.`;
    if (finishPlayerIfNeeded(room, player) && finishRoundIfNeeded(room)) {
      clearTimer(room);
      room.message = `${player.name} finished first. ${room.message}`;
    }
    return true;
  }

  if (finishPlayerIfNeeded(room, player)) {
    if (finishRoundIfNeeded(room)) {
      clearTimer(room);
      room.message = `${player.name} finished first. ${room.message}`;
      return true;
    }

    moveToNext(room);
    scheduleTurnTimer(io, room);
    room.message = `${player.name} finished and secured place ${room.roundResults.length}.`;
    return true;
  }

  moveToNext(room);
  scheduleTurnTimer(io, room);
  room.message = `${player.name} played ${playedCard.imageKey}.`;
  return true;
}

function maybeRunBotTurn(io: Server, room: Room) {
  const bot = getCurrentPlayer(room);
  if (room.status !== "playing" || !bot?.isBot) {
    return;
  }

  setTimeout(() => {
    if (room.status !== "playing" || getCurrentPlayer(room)?.id !== bot.id) {
      return;
    }

    if (room.pendingAction?.targetPlayerId === bot.id) {
      const answerRank = room.pendingAction.type === "skip" ? 1 : 2;
      const answer = bot.hand.find((card) => card.rank === answerRank);
      if (answer) {
        applyPlayedCard(io, room, bot, answer, answer.rank === 7 ? answer.suit : undefined);
      } else {
        resolvePending(io, room.id, bot.id);
        return;
      }
    } else {
      const playable = bot.hand.find((card) => canPlay(card, room, bot));
      if (playable) {
        applyPlayedCard(io, room, bot, playable, playable.rank === 7 ? playable.suit : undefined);
      } else if (canDrawCard(room, bot)) {
        const drawnOptions = drawFromDeck(room, room.rules.chooseDrawCards ? (room.activeModifier?.modifier === "choose_three" ? 3 : 2) : 1);
        const [card, ...unchosen] = drawnOptions;
        if (card) {
          bot.hand.push(card);
        }
        if (unchosen.length > 0) {
          room.deck.unshift(...unchosen);
        }
        room.message = `${bot.name} drew 1 card.`;
        moveToNext(room);
        scheduleTurnTimer(io, room);
      } else {
        moveToNext(room);
        scheduleTurnTimer(io, room);
      }
    }

    emitRoom(io, room);
    maybeRunBotTurn(io, room);
  }, 850).unref?.();
}

export function createRoom(io: Server, socketId: string, name: string, accountId?: string, accountWins?: number) {
  const room: Room = {
    id: roomCode(),
    status: "lobby",
    players: [],
    deck: [],
    discard: [],
    middleCard: null,
    lastPlayAttempt: null,
    currentPlayerIndex: 0,
    chosenSuit: null,
    activeModifier: null,
    skipAbilityUses: {},
    drawChoice: null,
    pendingAction: null,
    turnExpiresAt: null,
    winnerId: null,
    loserId: null,
    roundResults: [],
    rematchRequests: [],
    scores: {},
    chatMessageSequence: 0,
    chatMessages: [],
    message: "Waiting for players.",
    isMatchmaking: false,
    matchmakingEntryFee: defaultMatchmakingTable.entryFee,
    matchmakingTableId: null,
    matchmakingTableName: null,
    modifierPlayedThisTurn: false,
    rules: { ...defaultRules },
    timer: null,
  };

  const player = addPlayerToRoom(room, socketId, name, true, accountId, accountWins);
  room.scores[player.id] = 0;
  rooms.set(room.id, room);
  io.sockets.sockets.get(socketId)?.join(room.id);
  emitRoom(io, room);
  return { room, player };
}

export function addPlayerToRoom(room: Room, socketId: string, name: string, isHost = false, accountId?: string, accountWins?: number) {
  const player: Player = {
    id: randomUUID(),
    accountId,
    accountWins,
    socketId,
    name: name.trim() || "Player",
    hand: [],
    handCount: 0,
    isHost,
    isConnected: true,
    placement: null,
  };

  room.players.push(player);
  room.scores[player.id] ??= 0;
  return player;
}

function addBotToRoom(room: Room) {
  const botNames = [
    "JasonModeler",
    "GodOfWar2",
    "CupCollector",
    "OrosGhost",
    "SevenSmith",
    "BastosByte",
    "SwordRunner",
    "CardMancer",
    "GoldFalcon",
    "StackWizard",
    "TurnTaker",
    "HezPilot",
  ];
  const usedNames = new Set(room.players.map((player) => player.name));
  const name = botNames.find((candidate) => !usedNames.has(candidate)) ?? `Bot${room.players.length + 1}`;
  const player: Player = {
    id: randomUUID(),
    isBot: true,
    socketId: `bot-${randomUUID()}`,
    name,
    hand: [],
    handCount: 0,
    isHost: false,
    isConnected: true,
    placement: null,
  };
  room.players.push(player);
  room.scores[player.id] = 0;
  return player;
}

export function joinRoom(io: Server, socketId: string, roomId: string, name: string, accountId?: string, accountWins?: number) {
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

  const player = addPlayerToRoom(room, socketId, name, false, accountId, accountWins);
  io.sockets.sockets.get(socketId)?.join(room.id);
  room.message = `${player.name} joined.`;
  emitRoom(io, room);
  return { room, player };
}

export function resumeSession(io: Server, socketId: string, roomId: string, playerId: string, name?: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);

  player.socketId = socketId;
  player.isConnected = true;
  if (name?.trim()) {
    player.name = name.trim();
  }

  io.sockets.sockets.get(socketId)?.join(room.id);
  room.message = `${player.name} reconnected.`;
  if (room.status === "playing") {
    scheduleTurnTimer(io, room);
  }
  emitRoom(io, room);
  return { room, player };
}

export function returnToLobby(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);

  if (room.isMatchmaking) {
    throw new Error("Random matches cannot return to a private room.");
  }
  if (room.status !== "finished") {
    emitRoom(io, room);
    return { room, player };
  }

  clearTimer(room);
  room.status = "lobby";
  room.deck = [];
  room.discard = [];
  room.middleCard = null;
  room.lastPlayAttempt = null;
  room.currentPlayerIndex = 0;
  room.chosenSuit = null;
  setActiveModifier(room, null);
  room.drawChoice = null;
  room.modifierPlayedThisTurn = false;
  room.pendingAction = null;
  room.turnExpiresAt = null;
  room.winnerId = null;
  room.loserId = null;
  room.roundResults = [];
  room.rematchRequests = [];
  room.players.forEach((candidate) => {
    candidate.hand = [];
    candidate.isConnected = candidate.isConnected || candidate.id === player.id;
  });
  assignNextHost(room);
  room.message = `${player.name} returned to the room.`;
  emitRoom(io, room);
  return { room, player };
}

export function createMatchmakingRoom(
  io: Server,
  entries: Array<{ accountId: string; name: string; socketId: string; tableId?: string }>,
  botCount = 0,
) {
  if (entries.length + botCount < 2 || entries.length + botCount > 4) {
    throw new Error("Matchmaking rooms need 2 to 4 players.");
  }

  const { room, player: host } = createRoom(io, entries[0].socketId, entries[0].name, entries[0].accountId);
  const players = [host];

  for (const entry of entries.slice(1)) {
    players.push(addPlayerToRoom(room, entry.socketId, entry.name, false, entry.accountId));
    io.sockets.sockets.get(entry.socketId)?.join(room.id);
  }
  for (let index = 0; index < botCount; index += 1) {
    players.push(addBotToRoom(room));
  }

  room.isMatchmaking = true;
  const tableConfig = getMatchmakingTable(entries[0]?.tableId);
  room.rules = { ...matchmakingRules, ...tableConfig.rules, assistedPlay: tableConfig.assisted, manualCall: tableConfig.manualCall };
  room.matchmakingEntryFee = tableConfig.entryFee;
  room.matchmakingTableId = tableConfig.id;
  room.matchmakingTableName = tableConfig.name;
  startRound(io, room, { randomizePlayers: true });
  maybeRunBotTurn(io, room);
  return { room, players };
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

  startRound(io, room, { randomizePlayers: true });
}

export function setRoomRules(io: Server, roomId: string, playerId: string, rules: Partial<RoomRules>) {
  const room = requireRoom(roomId);
  const host = room.players.find((player) => player.id === playerId);

  if (!host?.isHost) {
    throw new Error("Only the host can change room rules.");
  }
  if (room.status !== "lobby") {
    throw new Error("Rules can only be changed before the game starts.");
  }

  const nextRules = { ...room.rules, ...rules };
  if (nextRules.manualCall) {
    nextRules.assistedPlay = false;
    nextRules.chooseDrawCards = false;
    nextRules.modifierCards = false;
    nextRules.skipOwnTurnCard = false;
  }

  room.rules = nextRules;
  room.message = "Room rules updated.";
  emitRoom(io, room);
}

function startRound(io: Server, room: Room, options: { randomizePlayers?: boolean } = {}) {
  if (options.randomizePlayers) {
    randomizePlayerOrderForRound(room);
  }

  room.deck = shuffle(createDeck(room.rules));
  room.discard = [];
  room.players.forEach((player) => {
    player.hand = drawFromDeck(room, 4);
    player.isConnected = true;
  });

  const middleCard = drawStartingCard(room);
  if (!middleCard) {
    throw new Error("Could not start the game because the deck is empty.");
  }
  room.middleCard = middleCard;
  room.lastPlayAttempt = null;
  room.discard = [middleCard];
  room.status = "playing";
  room.currentPlayerIndex = 0;
  room.pendingAction = null;
  room.chosenSuit = null;
  setActiveModifier(room, null);
  room.drawChoice = null;
  room.modifierPlayedThisTurn = false;
  room.winnerId = null;
  room.loserId = null;
  room.roundResults = [];
  room.rematchRequests = [];
  room.message = "Game started.";
  scheduleTurnTimer(io, room);
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
}

export function restartRoom(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  if (room.status !== "finished") {
    throw new Error("You can only retry after the game ends.");
  }

  const connectedPlayers = room.players.filter((player) => player.isConnected);
  if (room.players.length !== 2 || connectedPlayers.length !== 2) {
    throw new Error("Retry is only available in 1v1 rooms.");
  }

  if (!room.players.some((player) => player.id === playerId)) {
    throw new Error("Player not found.");
  }

  if (!room.rematchRequests.includes(playerId)) {
    room.rematchRequests.push(playerId);
  }

  if (connectedPlayers.every((player) => room.rematchRequests.includes(player.id))) {
    startRound(io, room, { randomizePlayers: true });
    return;
  }

  const player = requirePlayer(room, playerId);
  room.message = `${player.name} wants to play again.`;
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
  maybeRunBotTurn(io, room);
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

  if (room.rules.chooseDrawCards) {
    const choiceCount = room.activeModifier?.modifier === "choose_three" ? 3 : 2;
    const cards = drawFromDeck(room, choiceCount);
    if (cards.length === 0) {
      room.message = `${player.name} could not draw and lost the turn.`;
      moveToNext(room);
      scheduleTurnTimer(io, room);
      emitRoom(io, room);
      return;
    }
    const maxChoiceExpiresAt = Date.now() + drawChoiceWindowMs(room);
    const expiresAt = room.turnExpiresAt ? Math.min(room.turnExpiresAt, maxChoiceExpiresAt) : maxChoiceExpiresAt;
    clearTimer(room);
    room.drawChoice = { cards, expiresAt, playerId: player.id };
    room.turnExpiresAt = expiresAt;
    room.timer = setTimeout(() => {
      resolveDrawChoiceTimeout(io, room.id);
    }, Math.max(0, expiresAt - Date.now()));
    room.timer.unref?.();
    room.message = `${player.name} is choosing a draw card.`;
    emitRoom(io, room);
    return;
  }

  const [card] = drawFromDeck(room, 1);

  if (!card) {
    room.message = `${player.name} could not draw and lost the turn.`;
    moveToNext(room);
    scheduleTurnTimer(io, room);
    emitRoom(io, room);
    return;
  }

  player.hand.push(card);
  room.message = `${player.name} drew 1 card.`;
  moveToNext(room);
  scheduleTurnTimer(io, room);
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
}

export function chooseDrawCard(io: Server, roomId: string, playerId: string, cardId: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);
  const choice = room.drawChoice;

  if (!choice || choice.playerId !== player.id) {
    throw new Error("No draw choice is waiting for you.");
  }

  const pickedIndex = choice.cards.findIndex((card) => card.id === cardId);
  if (pickedIndex < 0) {
    throw new Error("Choose one of the offered cards.");
  }

  clearTimer(room);
  const [picked] = choice.cards.splice(pickedIndex, 1);
  player.hand.push(picked);
  room.deck.unshift(...choice.cards);
  room.drawChoice = null;
  room.message = `${player.name} chose a draw card.`;
  moveToNext(room);
  scheduleTurnTimer(io, room);
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
}

function resolveDrawChoiceTimeout(io: Server, roomId: string) {
  const room = requireRoom(roomId);
  const choice = room.drawChoice;

  if (!choice || choice.cards.length === 0) {
    return;
  }

  chooseDrawCard(io, roomId, choice.playerId, choice.cards[0].id);
}

export function skipTurnWithModifier(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);

  if (room.activeModifier?.modifier !== "skip_ability") {
    throw new Error("Skip ability is not active.");
  }
  if (getCurrentPlayer(room)?.id !== player.id || room.drawChoice) {
    throw new Error("It is not your turn.");
  }
  if ((room.skipAbilityUses[player.id] ?? 0) >= skipAbilityUseLimit) {
    throw new Error("You already used your two skips for this modifier.");
  }

  room.skipAbilityUses[player.id] = (room.skipAbilityUses[player.id] ?? 0) + 1;
  clearTimer(room);
  if (room.pendingAction?.targetPlayerId === player.id) {
    const target = room.players[getNextActiveIndex(room)];
    setPending(io, room, {
      ...room.pendingAction,
      targetPlayerId: target.id,
      expiresAt: Date.now() + pendingWindowMs(room),
    });
    room.message = `${player.name} used skip ability and passed the penalty to ${target.name}.`;
  } else {
    room.pendingAction = null;
    moveToNext(room);
    scheduleTurnTimer(io, room);
    room.message = `${player.name} used skip ability.`;
  }
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
}

export function callAttempt(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const caller = requirePlayer(room, playerId);
  const attempt = room.lastPlayAttempt;

  if (!room.rules.manualCall || room.status !== "playing") {
    throw new Error("Call Attempt is only available at manual tables.");
  }
  if (!attempt) {
    throw new Error("There is no move to call.");
  }
  if (attempt.playerId === caller.id) {
    throw new Error("You cannot call your own move.");
  }
  if (attempt.callerIds.includes(caller.id)) {
    throw new Error("You already called this attempt.");
  }

  const target = attempt.isLegal ? caller : requirePlayer(room, attempt.playerId);
  const drawn = drawFromDeck(room, 2);
  target.hand.push(...drawn);
  attempt.callerIds.push(caller.id);
  room.lastPlayAttempt = null;
  room.message = attempt.isLegal
    ? `${caller.name} called wrong and drew ${drawn.length} cards.`
    : `${caller.name} caught an illegal move. ${target.name} drew ${drawn.length} cards.`;
  emitRoom(io, room);
}

export function resolveTurnTimeout(io: Server, roomId: string) {
  const room = requireRoom(roomId);

  if (room.status !== "playing" || room.pendingAction) {
    return;
  }

  const player = getCurrentPlayer(room);
  if (!player) {
    return;
  }

  const [card] = drawFromDeck(room, 1);
  if (card) {
    player.hand.push(card);
    room.message = `${player.name} ran out of time, drew 1 card, and lost the turn.`;
  } else {
    room.message = `${player.name} ran out of time and lost the turn.`;
  }

  moveToNext(room);
  scheduleTurnTimer(io, room);
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
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
  scheduleTurnTimer(io, room);
  emitRoom(io, room);
  maybeRunBotTurn(io, room);
}

export function leaveRoom(io: Server, roomId: string, playerId: string) {
  const room = requireRoom(roomId);
  const player = requirePlayer(room, playerId);

  player.isConnected = false;
  room.message = `${player.name} left the room.`;

  if (room.status === "lobby") {
    room.players = room.players.filter((candidate) => candidate.id !== player.id);
    delete room.scores[player.id];

    if (room.players.length === 0) {
      rooms.delete(room.id);
      return;
    }

    assignNextHost(room);
  } else if (room.status === "playing" && !hasFinished(room, player)) {
    if (player.isHost) {
      assignNextHost(room);
    }
    if (activePlayers(room).length <= 1) {
      finishRoundByForfeit(room, player);
    } else if (getCurrentPlayer(room)?.id === player.id) {
      moveToNext(room);
    }
    scheduleTurnTimer(io, room);
  }

  emitRoom(io, room);
}

export function handleDisconnect(io: Server, socketId: string) {
  for (const room of rooms.values()) {
    const player = room.players.find((candidate) => candidate.socketId === socketId);

    if (player) {
      player.isConnected = false;
      room.message = `${player.name} disconnected.`;
      if (player.isHost) {
        assignNextHost(room);
      }
      if (room.status === "playing" && !hasFinished(room, player)) {
        if (getCurrentPlayer(room)?.id === player.id && activePlayers(room).length > 1) {
          moveToNext(room);
          scheduleTurnTimer(io, room);
        } else if (activePlayers(room).length <= 1) {
          clearTimer(room);
          room.turnExpiresAt = null;
        }
      }
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
