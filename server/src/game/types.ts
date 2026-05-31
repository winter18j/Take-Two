export const RESPONSE_WINDOW_MS = 10_000;
export const TURN_WINDOW_MS = 15_000;

export const suits = ["sticks", "cups", "swords", "gold"] as const;
export const ranks = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];
export type GameStatus = "lobby" | "playing" | "finished";
export type ModifierKind = "choose_three" | "draw_half" | "draw_one_half" | "skip_ability" | "timer_five";
export type CardType = "modifier" | "playing" | "skip_turn";

export type Card = {
  id: string;
  type?: CardType;
  suit: Suit;
  rank: Rank;
  imageKey: string;
  imagePath: string;
  modifier?: ModifierKind;
};

export type RoomRules = {
  assistedPlay: boolean;
  chooseDrawCards: boolean;
  manualCall: boolean;
  modifierCards: boolean;
  skipOwnTurnCard: boolean;
};

export type DrawChoice = {
  cards: Card[];
  expiresAt: number;
  playerId: string;
};

export type PublicPlayer = {
  id: string;
  accountId?: string;
  accountWins?: number;
  isBot?: boolean;
  name: string;
  handCount: number;
  isHost: boolean;
  isConnected: boolean;
  placement: number | null;
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
  lastPlayAttempt: LastPlayAttempt | null;
  currentPlayerIndex: number;
  chosenSuit: Suit | null;
  activeModifier: Card | null;
  skipAbilityUses: Record<string, number>;
  drawChoice: DrawChoice | null;
  pendingAction: PendingAction | null;
  turnExpiresAt: number | null;
  winnerId: string | null;
  loserId: string | null;
  roundResults: string[];
  rematchRequests: string[];
  scores: Record<string, number>;
  chatMessageSequence: number;
  chatMessages: RoomChatMessage[];
  message: string;
  isMatchmaking?: boolean;
  isTutorial?: boolean;
  matchmakingEntryFee: number;
  matchmakingTableId: string | null;
  matchmakingTableName: string | null;
  modifierPlayedThisTurn: boolean;
  rules: RoomRules;
  timer: NodeJS.Timeout | null;
};

export type LastPlayAttempt = {
  callerIds: string[];
  cardId: string;
  isLegal: boolean;
  playerId: string;
};

export type RoomChatMessage = {
  body: string;
  createdAt: string;
  id: string;
  playerId: string;
  playerName: string;
  roomId: string;
};

export type ClientGameState = {
  roomId: string;
  status: GameStatus;
  players: PublicPlayer[];
  hand: Card[];
  deckCount: number;
  discardCount: number;
  middleCard: Card | null;
  lastPlayAttempt: LastPlayAttempt | null;
  currentPlayerId: string | null;
  chosenSuit: Suit | null;
  activeModifier: Card | null;
  skipAbilityUsesRemaining: number;
  drawChoice: DrawChoice | null;
  pendingAction: PendingAction | null;
  turnExpiresAt: number | null;
  canDraw: boolean;
  winnerId: string | null;
  loserId: string | null;
  roundResults: string[];
  rematchRequests: string[];
  scores: Record<string, number>;
  message: string;
  isMatchmaking: boolean;
  isTutorial: boolean;
  matchmakingEntryFee: number;
  matchmakingTableId: string | null;
  matchmakingTableName: string | null;
  rules: RoomRules;
  youAreHost: boolean;
};
