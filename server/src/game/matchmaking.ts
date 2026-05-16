export type MatchmakingEntry = {
  accountId: string;
  hiddenScore: number;
  joinedAt: number;
  name: string;
  socketId: string;
};

export type MatchmakingMatch = {
  botCount: number;
  entries: MatchmakingEntry[];
};

export class MatchmakingQueue {
  private entries = new Map<string, MatchmakingEntry>();

  add(entry: MatchmakingEntry) {
    for (const queued of this.entries.values()) {
      if (queued.accountId === entry.accountId) {
        this.entries.delete(queued.socketId);
      }
    }
    this.entries.set(entry.socketId, entry);
  }

  removeSocket(socketId: string) {
    this.entries.delete(socketId);
  }

  removeAccount(accountId: string) {
    for (const queued of this.entries.values()) {
      if (queued.accountId === accountId) {
        this.entries.delete(queued.socketId);
      }
    }
  }

  size() {
    return this.entries.size;
  }

  status(socketId: string, now = Date.now()) {
    const entry = this.entries.get(socketId);
    if (!entry) {
      return null;
    }

    const sorted = this.sortedEntries();
    return {
      queued: true,
      queueSize: sorted.length,
      seconds: Math.max(0, Math.floor((now - entry.joinedAt) / 1000)),
    };
  }

  findMatch(now = Date.now()): MatchmakingMatch | null {
    const sorted = this.sortedEntries();
    if (sorted.length < 2) {
      const solo = sorted[0];
      if (solo && now - solo.joinedAt >= 10_000) {
        this.entries.delete(solo.socketId);
        return { botCount: 1, entries: [solo] };
      }
      return null;
    }

    const oldestWait = now - sorted[0].joinedAt;
    if (sorted.length >= 4 && oldestWait < 2_000) {
      return null;
    }
    if (sorted.length < 4 && oldestWait < 10_000) {
      return null;
    }

    const best = bestGroup(sorted, sorted.length >= 4 ? 4 : sorted.length, now);
    for (const entry of best) {
      this.entries.delete(entry.socketId);
    }

    return { botCount: 0, entries: best };
  }

  private sortedEntries() {
    return [...this.entries.values()].sort((left, right) => left.joinedAt - right.joinedAt);
  }
}

function ratingTolerance(waitSeconds: number) {
  return Math.min(720, 90 + waitSeconds * 38);
}

function bestGroup(entries: MatchmakingEntry[], size: number, now: number) {
  let best = entries.slice(0, size);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const anchor of entries) {
    const waitSeconds = (now - anchor.joinedAt) / 1000;
    const tolerance = ratingTolerance(waitSeconds);
    const candidates = entries
      .filter((entry) => Math.abs(entry.hiddenScore - anchor.hiddenScore) <= tolerance)
      .sort((left, right) => {
        const leftDistance = Math.abs(left.hiddenScore - anchor.hiddenScore);
        const rightDistance = Math.abs(right.hiddenScore - anchor.hiddenScore);
        return leftDistance - rightDistance || left.joinedAt - right.joinedAt;
      })
      .slice(0, size);

    if (candidates.length < size) {
      continue;
    }

    const scores = candidates.map((entry) => entry.hiddenScore);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread < bestScore) {
      best = candidates;
      bestScore = spread;
    }
  }

  return best;
}
