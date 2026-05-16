export type MatchmakingEntry = {
  accountId: string;
  hiddenScore: number;
  joinedAt: number;
  name: string;
  socketId: string;
};

export type MatchmakingMatch = {
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
      return null;
    }

    let best: MatchmakingEntry[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const anchor of sorted) {
      const waitSeconds = (now - anchor.joinedAt) / 1000;
      const maxPlayers = sorted.length >= 4 ? 4 : sorted.length >= 3 && waitSeconds >= 5 ? 3 : 2;
      const minPlayers = waitSeconds >= 18 ? 2 : sorted.length >= 3 && waitSeconds >= 7 ? 3 : 2;
      const tolerance = ratingTolerance(waitSeconds);
      const candidates = sorted
        .filter((entry) => Math.abs(entry.hiddenScore - anchor.hiddenScore) <= tolerance)
        .sort((left, right) => {
          const leftDistance = Math.abs(left.hiddenScore - anchor.hiddenScore);
          const rightDistance = Math.abs(right.hiddenScore - anchor.hiddenScore);
          return leftDistance - rightDistance || left.joinedAt - right.joinedAt;
        })
        .slice(0, maxPlayers);

      if (candidates.length < minPlayers) {
        continue;
      }

      const scores = candidates.map((entry) => entry.hiddenScore);
      const spread = Math.max(...scores) - Math.min(...scores);
      const ageBonus = Math.max(...candidates.map((entry) => now - entry.joinedAt)) / 1000;
      const missingPenalty = (4 - candidates.length) * 140;
      const candidateScore = spread + missingPenalty - ageBonus * 8;

      if (candidateScore < bestScore) {
        best = candidates;
        bestScore = candidateScore;
      }
    }

    if (!best || best.length < 2) {
      return null;
    }

    for (const entry of best) {
      this.entries.delete(entry.socketId);
    }

    return { entries: best };
  }

  private sortedEntries() {
    return [...this.entries.values()].sort((left, right) => left.joinedAt - right.joinedAt);
  }
}

function ratingTolerance(waitSeconds: number) {
  return Math.min(720, 90 + waitSeconds * 38);
}
