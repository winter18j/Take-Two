import assert from "node:assert/strict";
import { test } from "node:test";
import { addPlayerToRoom, createRoom, drawUntilPlayable, playCard, resolveTurnTimeout, restartRoom, startGame } from "./rooms.js";
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

  startGame(io, room.id, player.id);

  assert.ok(room.middleCard);
  assert.notEqual(room.middleCard.rank, 1);
  assert.notEqual(room.middleCard.rank, 2);
  assert.notEqual(room.middleCard.rank, 7);
  assert.equal(room.chosenSuit, null);
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
