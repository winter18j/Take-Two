export const RESPONSE_WINDOW_MS = 10_000;

export const suits = ["sticks", "cups", "swords", "gold"] as const;
export const ranks = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];
export type GameStatus = "lobby" | "playing" | "finished";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  imageKey: string;
  imagePath: string;
};

export type PublicPlayer = {
  id: string;
  name: string;
  handCount: number;
  isHost: boolean;
  isConnected: boolean;
};

export type Player = PublicPlayer & {
  socketId: string;
  hand: Card[];
};

export type PendingAction =
  | {
      type: "skip";
      targetPlayerId: string;
      expiresAt: number;
    }
  | {
      type: "draw";
      targetPlayerId: string;
      amount: number;
      expiresAt: number;
    };

export type Room = {
  id: string;
  status: GameStatus;
  players: Player[];
  deck: Card[];
  discard: Card[];
  middleCard: Card | null;
  currentPlayerIndex: number;
  chosenSuit: Suit | null;
  pendingAction: PendingAction | null;
  winnerId: string | null;
  message: string;
  timer: NodeJS.Timeout | null;
};

export type ClientGameState = {
  roomId: string;
  status: GameStatus;
  players: PublicPlayer[];
  hand: Card[];
  deckCount: number;
  discardCount: number;
  middleCard: Card | null;
  currentPlayerId: string | null;
  chosenSuit: Suit | null;
  pendingAction: PendingAction | null;
  canDraw: boolean;
  winnerId: string | null;
  message: string;
  youAreHost: boolean;
};
