export const tokenProducts = [
  { id: "tokens_10", tokens: 10, priceUsd: 0.99 },
  { id: "tokens_20", tokens: 20, priceUsd: 1.59 },
  { id: "tokens_30", tokens: 30, priceUsd: 1.99 },
  { id: "tokens_50", tokens: 50, priceUsd: 2.99 },
  { id: "tokens_75", tokens: 75, priceUsd: 3.99 },
  { id: "tokens_100", tokens: 100, priceUsd: 4.99 },
] as const;

export const appEntitlements = {
  removeAds: { id: "remove_ads", priceUsd: 0.99, bonusTokens: 3 },
  premiumMonthly: { id: "premium_monthly", priceUsd: 5.99, unlimitedTokens: true, removesAds: true },
} as const;

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
