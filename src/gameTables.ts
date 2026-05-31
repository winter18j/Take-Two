export type MatchmakingTableId = "street" | "cafe" | "medina" | "palace" | "gold" | "royal" | "sultan";

export type MatchmakingTable = {
  assisted: boolean;
  entryFee: number;
  id: MatchmakingTableId;
  iconImage: number;
  manualCall: boolean;
  matchBackground: number;
  name: string;
  theme: string;
};

export const matchmakingTables: MatchmakingTable[] = [
  table("street", "Street", 25, "Open-air table", require("../resources/tables/icons/street.png"), require("../resources/tables/match/street.png")),
  table("cafe", "Cafe", 100, "Casual stakes", require("../resources/tables/icons/cafe.png"), require("../resources/tables/match/cafe.png")),
  table("medina", "Medina", 500, "Market night", require("../resources/tables/icons/medina.png"), require("../resources/tables/match/medina.png")),
  table("palace", "Palace", 2500, "High-stakes room", require("../resources/tables/icons/palace.png"), require("../resources/tables/match/palace.png")),
  table("gold", "Gold", 10000, "Heavy coin table", require("../resources/tables/icons/gold.png"), require("../resources/tables/match/gold.png")),
  table("royal", "Royal", 50000, "No card help", require("../resources/tables/icons/royal.png"), require("../resources/tables/match/royal.png"), { assisted: false }),
  table("sultan", "Sultan", 200000, "Manual call table", require("../resources/tables/icons/sultan.png"), require("../resources/tables/match/sultan.png"), { assisted: false, manualCall: true }),
];

export const comingSoonTable = {
  entryFee: 0,
  id: "coming-soon",
  iconImage: require("../resources/tables/icons/coming-soon.png"),
  name: "Coming Soon",
  theme: "Next arena",
};

export function getMatchmakingTable(id: string | null | undefined) {
  return matchmakingTables.find((tableConfig) => tableConfig.id === id) ?? matchmakingTables[0];
}

export function payoutForPlacement(entryFee: number, playerCount: number, placement: number) {
  if (placement < 0) {
    return 0;
  }

  const multipliers: Record<number, number[]> = {
    2: [1.8, 0],
    3: [1.8, 0.9, 0],
    4: [1.8, 1.35, 0.45, 0],
  };

  return Math.round(entryFee * (multipliers[playerCount]?.[placement] ?? 0));
}

function table(
  id: MatchmakingTableId,
  name: string,
  entryFee: number,
  theme: string,
  iconImage: number,
  matchBackground: number,
  overrides: Partial<Pick<MatchmakingTable, "assisted" | "manualCall">> = {},
): MatchmakingTable {
  return {
    assisted: true,
    entryFee,
    id,
    iconImage,
    manualCall: false,
    matchBackground,
    name,
    theme,
    ...overrides,
  };
}
