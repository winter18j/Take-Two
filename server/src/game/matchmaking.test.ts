import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakingQueue } from "./matchmaking.js";

function entry(socketId: string, hiddenScore: number, joinedAt: number) {
  return {
    accountId: `account-${socketId}`,
    hiddenScore,
    joinedAt,
    name: socketId,
    socketId,
  };
}

test("matchmaking chooses the closest hidden score group up to four players", () => {
  const queue = new MatchmakingQueue();
  const now = 30_000;

  queue.add(entry("a", 1000, 0));
  queue.add(entry("b", 1030, 0));
  queue.add(entry("c", 1060, 0));
  queue.add(entry("d", 1100, 0));
  queue.add(entry("far", 1600, 0));

  const match = queue.findMatch(now);

  assert.deepEqual(
    match?.entries.map((candidate) => candidate.socketId),
    ["a", "b", "c", "d"],
  );
});
