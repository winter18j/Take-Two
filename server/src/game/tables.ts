export type MatchmakingTableId = "street" | "cafe" | "medina" | "palace" | "gold" | "royal" | "sultan";

export type MatchmakingTable = {
  assisted: boolean;
  entryFee: number;
  id: MatchmakingTableId;
  manualCall: boolean;
  name: string;
  rules: {
    chooseDrawCards: boolean;
    modifierCards: boolean;
    skipOwnTurnCard: boolean;
  };
};

export const matchmakingTables: MatchmakingTable[] = [
  table("street", "Street", 25),
  table("cafe", "Cafe", 100),
  table("medina", "Medina", 500),
  table("palace", "Palace", 2500),
  table("gold", "Gold", 10000),
  table("royal", "Royal", 50000, { assisted: false }),
  table("sultan", "Sultan", 200000, {
    assisted: false,
    manualCall: true,
    rules: { chooseDrawCards: false, modifierCards: false, skipOwnTurnCard: false },
  }),
];

export const defaultMatchmakingTable = matchmakingTables[0];

export function getMatchmakingTable(id: unknown) {
  return matchmakingTables.find((tableConfig) => tableConfig.id === id) ?? defaultMatchmakingTable;
}

export function payoutForPlacement(entryFee: number, playerCount: number, placement: number) {
  if (placement < 0) {
    return 0;
  }

  if (playerCount === 2) {
    return [1.8, 0][placement] ? Math.round(entryFee * [1.8, 0][placement]) : 0;
  }
  if (playerCount === 3) {
    return [1.8, 0.9, 0][placement] ? Math.round(entryFee * [1.8, 0.9, 0][placement]) : 0;
  }
  if (playerCount === 4) {
    return [1.8, 1.35, 0.45, 0][placement] ? Math.round(entryFee * [1.8, 1.35, 0.45, 0][placement]) : 0;
  }

  return 0;
}

function table(
  id: MatchmakingTableId,
  name: string,
  entryFee: number,
  overrides: Partial<Omit<MatchmakingTable, "entryFee" | "id" | "name">> = {},
): MatchmakingTable {
  return {
    assisted: true,
    entryFee,
    id,
    manualCall: false,
    name,
    rules: { chooseDrawCards: true, modifierCards: true, skipOwnTurnCard: true },
    ...overrides,
  };
}
