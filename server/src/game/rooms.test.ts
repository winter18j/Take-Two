import assert from "node:assert/strict";
import { test } from "node:test";
import { addPlayerToRoom, chooseDrawCard, createRoom, createTutorialRoom, drawUntilPlayable, handleDisconnect, playCard, randomizePlayerOrderForRound, resolveTurnTimeout, restartRoom, resumeSession, setRoomRules, skipTurnWithModifier, startGame } from "./rooms.js";
import { Card, Room, Suit } from "./types.js";

function fakeIo() {
  const joinedRooms: string[] = [];
  const sockets = new Map<string, { join: (roomId: string) => void }>();

  const io = {
    sockets: {
      sockets,
    },
    to() {
      return {
        emit() {
          return undefined;
        },
      };
    },
  };

  sockets.set("socket-1", {
    join(roomId: string) {
      joinedRooms.push(roomId);
    },
  });
  sockets.set("socket-3", {
    join(roomId: string) {
      joinedRooms.push(roomId);
    },
  });

  return { io: io as never, joinedRooms };
}

function card(suit: Suit, rank: Card["rank"]): Card {
  const imageKey = `${suit}-${rank}`;

  return {
    id: imageKey,
    suit,
    rank,
    imageKey,
    imagePath: `/cards/${imageKey}.png`,
  };
}

function playingRoom() {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  const secondPlayer = addPlayerToRoom(room, "socket-2", "Player 2");

  room.status = "playing";
  room.currentPlayerIndex = 0;
  room.pendingAction = null;
  room.turnExpiresAt = null;
  room.chosenSuit = null;
  room.winnerId = null;
  room.middleCard = card("sticks", 5);
  room.discard = [room.middleCard];
  secondPlayer.hand = [card("gold", 10)];

  return { io, room: room as Room, player };
}

test("drawUntilPlayable draws one card and ends the turn", () => {
  const { io, room, player } = playingRoom();
  player.hand = [card("sticks", 3)];
  room.deck = [card("cups", 4)];

  drawUntilPlayable(io, room.id, player.id);

  assert.deepEqual(
    player.hand.map((heldCard) => heldCard.id),
    ["sticks-3", "cups-4"],
  );
  assert.equal(room.deck.length, 0);
  assert.equal(room.currentPlayerIndex, 1);
});

test("drawUntilPlayable rejects a second draw because the turn advanced", () => {
  const { io, room, player } = playingRoom();
  player.hand = [card("sticks", 3)];
  room.deck = [card("cups", 4), card("cups", 6)];

  drawUntilPlayable(io, room.id, player.id);

  assert.throws(
    () => drawUntilPlayable(io, room.id, player.id),
    /not your turn/,
  );
  assert.equal(player.hand.length, 2);
  assert.equal(room.deck.length, 1);
});

test("drawUntilPlayable ends the turn even when no playable card is found", () => {
  const { io, room, player } = playingRoom();
  player.hand = [card("cups", 3)];
  room.deck = [card("cups", 4), card("swords", 10), card("gold", 5), card("sticks", 12)];

  drawUntilPlayable(io, room.id, player.id);

  assert.deepEqual(
    player.hand.map((heldCard) => heldCard.id),
    ["cups-3", "cups-4"],
  );
  assert.deepEqual(
    room.deck.map((deckCard) => deckCard.id),
    ["swords-10", "gold-5", "sticks-12"],
  );
  assert.equal(room.currentPlayerIndex, 1);
  assert.match(room.message, /drew 1 card/);
});

test("startGame does not choose an action card as the first middle card", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  addPlayerToRoom(room, "socket-2", "Player 2");
  setRoomRules(io, room.id, player.id, {
    chooseDrawCards: true,
    modifierCards: true,
    skipOwnTurnCard: true,
  });

  startGame(io, room.id, player.id);

  assert.ok(room.middleCard);
  assert.equal(room.middleCard.type, "playing");
  assert.notEqual(room.middleCard.rank, 1);
  assert.notEqual(room.middleCard.rank, 2);
  assert.notEqual(room.middleCard.rank, 7);
  assert.equal(room.chosenSuit, null);
});

test("round player order can be randomized before dealing", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  const secondPlayer = addPlayerToRoom(room, "socket-2", "Player 2");
  const thirdPlayer = addPlayerToRoom(room, "socket-3", "Player 3");
  const fourthPlayer = addPlayerToRoom(room, "socket-4", "Player 4");

  randomizePlayerOrderForRound(room, () => 0);

  assert.deepEqual(
    room.players.map((candidate) => candidate.id),
    [secondPlayer.id, thirdPlayer.id, fourthPlayer.id, player.id],
  );
  assert.equal(room.currentPlayerIndex, 0);
});

test("draw reshuffles played cards except the last played card when the deck is empty", () => {
  const { io, room, player } = playingRoom();
  const lastPlayed = card("sticks", 5);
  const recycled = card("cups", 11);

  player.hand = [card("gold", 3)];
  room.deck = [];
  room.middleCard = lastPlayed;
  room.discard = [lastPlayed, recycled];

  drawUntilPlayable(io, room.id, player.id);

  assert.deepEqual(
    player.hand.map((heldCard) => heldCard.id),
    ["gold-3", "cups-11"],
  );
  assert.deepEqual(
    room.discard.map((discardCard) => discardCard.id),
    ["sticks-5"],
  );
  assert.equal(room.deck.length, 0);
  assert.equal(room.currentPlayerIndex, 1);
});

test("turn timeout draws one card for the current player and skips the turn", () => {
  const { io, room, player } = playingRoom();
  player.hand = [card("gold", 3)];
  room.deck = [card("cups", 11)];

  resolveTurnTimeout(io, room.id);

  assert.deepEqual(
    player.hand.map((heldCard) => heldCard.id),
    ["gold-3", "cups-11"],
  );
  assert.equal(room.currentPlayerIndex, 1);
  assert.match(room.message, /ran out of time/);
});

test("a 7 can be chained regardless of suit while the chosen suit is active", () => {
  const { io, room, player } = playingRoom();
  const secondPlayer = room.players[1];

  room.middleCard = card("sticks", 7);
  room.discard = [room.middleCard];
  player.hand = [card("cups", 7), card("gold", 3), card("cups", 4)];
  secondPlayer.hand = [card("gold", 7), card("cups", 4)];

  playCard(io, room.id, player.id, "cups-7", "swords");

  assert.equal(room.chosenSuit, "swords");
  assert.equal(room.currentPlayerIndex, 1);

  playCard(io, room.id, secondPlayer.id, "gold-7", "gold");

  assert.equal(room.chosenSuit, "gold");
  assert.equal(room.middleCard?.id, "gold-7");
  assert.equal(room.currentPlayerIndex, 0);
});

test("game continues after one player finishes until only one player has cards", () => {
  const { io, room, player } = playingRoom();
  const secondPlayer = room.players[1];
  const thirdPlayer = addPlayerToRoom(room, "socket-3", "Player 3");

  player.hand = [card("sticks", 3)];
  secondPlayer.hand = [card("sticks", 4)];
  thirdPlayer.hand = [card("gold", 10)];
  room.middleCard = card("sticks", 5);
  room.discard = [room.middleCard];

  playCard(io, room.id, player.id, "sticks-3");

  assert.equal(room.status, "playing");
  assert.equal(room.winnerId, player.id);
  assert.deepEqual(room.roundResults, [player.id]);
  assert.equal(room.currentPlayerIndex, 1);

  playCard(io, room.id, secondPlayer.id, "sticks-4");

  assert.equal(room.status, "finished");
  assert.equal(room.loserId, thirdPlayer.id);
  assert.deepEqual(room.roundResults, [player.id, secondPlayer.id, thirdPlayer.id]);
});

test("restartRoom starts a new 1v1 round and keeps scores", () => {
  const { io, room, player } = playingRoom();
  const secondPlayer = room.players[1];

  player.hand = [card("sticks", 3)];
  secondPlayer.hand = [card("gold", 10)];
  room.middleCard = card("sticks", 5);
  room.discard = [room.middleCard];

  playCard(io, room.id, player.id, "sticks-3");

  assert.equal(room.status, "finished");
  assert.equal(room.scores[player.id], 1);

  restartRoom(io, room.id, player.id);
  assert.equal(room.status, "finished");
  assert.deepEqual(room.rematchRequests, [player.id]);

  restartRoom(io, room.id, secondPlayer.id);

  assert.equal(room.status, "playing");
  assert.equal(room.scores[player.id], 1);
  assert.equal(player.hand.length, 4);
  assert.equal(secondPlayer.hand.length, 4);
});

test("a 7 no longer chains freely after a non-7 is played after the chosen suit", () => {
  const { io, room, player } = playingRoom();
  const secondPlayer = room.players[1];

  room.middleCard = card("sticks", 7);
  room.discard = [room.middleCard];
  player.hand = [card("cups", 7), card("gold", 3), card("cups", 4)];
  secondPlayer.hand = [card("gold", 7), card("swords", 7)];

  playCard(io, room.id, player.id, "cups-7", "gold");
  playCard(io, room.id, secondPlayer.id, "gold-7", "gold");
  playCard(io, room.id, player.id, "gold-3");

  assert.equal(room.chosenSuit, null);
  assert.equal(room.middleCard?.id, "gold-3");
  assert.equal(room.currentPlayerIndex, 1);

  assert.throws(
    () => playCard(io, room.id, secondPlayer.id, "swords-7", "cups"),
    /cannot play that card/,
  );
});

test("disconnected player can resume the same room session", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "resume-socket-1", "Player 1");
  addPlayerToRoom(room, "resume-socket-2", "Player 2");
  room.status = "playing";
  room.middleCard = card("sticks", 5);
  room.discard = [room.middleCard];

  handleDisconnect(io, "resume-socket-1");

  assert.equal(player.isConnected, false);
  assert.equal(room.status, "playing");

  const resumed = resumeSession(io, "socket-3", room.id, player.id, "Player 1");

  assert.equal(resumed.player.id, player.id);
  assert.equal(player.socketId, "socket-3");
  assert.equal(player.isConnected, true);
  assert.equal(room.status, "playing");
});

test("choose draw cards lets player pick one and returns the rest to deck", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  addPlayerToRoom(room, "socket-2", "Player 2");
  setRoomRules(io, room.id, player.id, { chooseDrawCards: true });
  startGame(io, room.id, player.id);

  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);
  room.deck = [card("gold", 3), card("cups", 4), card("swords", 5)];
  drawUntilPlayable(io, room.id, player.id);

  assert.equal(room.drawChoice?.cards.length, 2);
  chooseDrawCard(io, room.id, player.id, "cups-4");

  assert.equal(player.hand.some((heldCard) => heldCard.id === "cups-4"), true);
  assert.equal(room.deck[0]?.id, "gold-3");
  assert.equal(room.drawChoice, null);
});

test("skip own turn card can pass a stacked draw penalty", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  const secondPlayer = addPlayerToRoom(room, "socket-2", "Player 2");
  const thirdPlayer = addPlayerToRoom(room, "socket-3", "Player 3");
  setRoomRules(io, room.id, player.id, { skipOwnTurnCard: true });
  startGame(io, room.id, player.id);

  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === secondPlayer.id);
  room.pendingAction = { amount: 8, expiresAt: Date.now() + 1000, targetPlayerId: secondPlayer.id, type: "draw" };
  secondPlayer.hand = [{
    id: "skip-turn-1",
    imageKey: "skip-turn",
    imagePath: "/cards/skip-turn.png",
    rank: 10,
    suit: "gold",
    type: "skip_turn",
  }];

  playCard(io, room.id, secondPlayer.id, "skip-turn-1");

  assert.equal(room.pendingAction?.type, "draw");
  assert.equal(room.pendingAction?.amount, 8);
  assert.notEqual(room.pendingAction?.targetPlayerId, secondPlayer.id);
  assert.equal(room.roundResults.includes(secondPlayer.id), true);
});

test("modifier cards can change draw penalty and only one modifier can be played per turn", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  const secondPlayer = addPlayerToRoom(room, "socket-2", "Player 2");
  setRoomRules(io, room.id, player.id, { modifierCards: true });
  startGame(io, room.id, player.id);

  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);
  room.middleCard = card("gold", 2);
  room.discard = [room.middleCard];
  player.hand = [{
    id: "modifier-draw-one-half-1",
    imageKey: "modifier-draw-one-half",
    imagePath: "/cards/modifier-draw-one-half.png",
    modifier: "draw_one_half",
    rank: 10,
    suit: "gold",
    type: "modifier",
  }, {
    id: "modifier-timer-five-1",
    imageKey: "modifier-timer-five",
    imagePath: "/cards/modifier-timer-five.png",
    modifier: "timer_five",
    rank: 5,
    suit: "gold",
    type: "modifier",
  }, card("cups", 2)];

  playCard(io, room.id, player.id, "modifier-draw-one-half-1");
  assert.throws(() => playCard(io, room.id, player.id, "modifier-timer-five-1"), /cannot play that card/);
  playCard(io, room.id, player.id, "cups-2");

  assert.equal(room.activeModifier?.modifier, "draw_one_half");
  assert.equal(room.roundResults.includes(player.id), true);
  assert.equal(room.players.find((candidate) => candidate.id === player.id)?.hand.length, 0);
});

test("skip ability modifier lets current player skip without a skip card", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  const secondPlayer = addPlayerToRoom(room, "socket-2", "Player 2");
  setRoomRules(io, room.id, player.id, { modifierCards: true });
  startGame(io, room.id, player.id);

  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);
  room.activeModifier = {
    id: "modifier-skip-ability-1",
    imageKey: "modifier-skip-ability",
    imagePath: "/cards/modifier-skip-ability.png",
    modifier: "skip_ability",
    rank: 12,
    suit: "gold",
    type: "modifier",
  };

  skipTurnWithModifier(io, room.id, player.id);

  assert.equal(room.players[room.currentPlayerIndex]?.id, secondPlayer.id);
});

test("skip ability modifier can only be used twice by each player", () => {
  const { io } = fakeIo();
  const { room, player } = createRoom(io, "socket-1", "Player 1");
  addPlayerToRoom(room, "socket-2", "Player 2");
  setRoomRules(io, room.id, player.id, { modifierCards: true });
  startGame(io, room.id, player.id);

  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);
  room.activeModifier = {
    id: "modifier-skip-ability-1",
    imageKey: "modifier-skip-ability",
    imagePath: "/cards/modifier-skip-ability.png",
    modifier: "skip_ability",
    rank: 12,
    suit: "gold",
    type: "modifier",
  };

  skipTurnWithModifier(io, room.id, player.id);
  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);
  skipTurnWithModifier(io, room.id, player.id);
  room.currentPlayerIndex = room.players.findIndex((candidate) => candidate.id === player.id);

  assert.equal(room.skipAbilityUses[player.id], 2);
  assert.throws(
    () => skipTurnWithModifier(io, room.id, player.id),
    /already used your two skips/,
  );
});

test("tutorial room starts immediately with one bot and modern rules", () => {
  const { io } = fakeIo();
  const { room } = createTutorialRoom(io, "socket-1", "Student");

  assert.equal(room.status, "playing");
  assert.equal(room.isTutorial, true);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1]?.isBot, true);
  assert.equal(room.rules.chooseDrawCards, true);
  assert.equal(room.rules.modifierCards, true);
});
