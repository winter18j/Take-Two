export const coinAdPacks = [
  { id: "coins_500_ads", coins: 500, adsRequired: 3 },
  { id: "coins_1200_ads", coins: 1200, adsRequired: 6 },
  { id: "coins_3000_ads", coins: 3000, adsRequired: 12 },
  { id: "coins_7500_ads", coins: 7500, adsRequired: 25 },
] as const;

export const gemAdPacks = [
  { id: "gems_120_ads", gems: 120, adsRequired: 3 },
  { id: "gems_300_ads", gems: 300, adsRequired: 7 },
  { id: "gems_800_ads", gems: 800, adsRequired: 16 },
  { id: "gems_2000_ads", gems: 2000, adsRequired: 35 },
] as const;

export function hiddenScore(wins: number, losses: number, games: number) {
  if (games <= 0) {
    return 1000;
  }

  const winRate = wins / games;
  const lossRate = losses / games;
  const experience = Math.min(300, Math.log2(games + 1) * 80);
  return Math.round(1000 + winRate * 500 - lossRate * 350 + experience);
}

export function quitterBanHours(quitterFlag: number) {
  if (quitterFlag >= 5) {
    return 120;
  }
  if (quitterFlag >= 4) {
    return 24;
  }
  if (quitterFlag >= 3) {
    return 3;
  }
  if (quitterFlag >= 2) {
    return 2;
  }
  if (quitterFlag >= 1) {
    return 1;
  }
  return 0;
}
