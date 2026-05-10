import { Card, Rank, Suit, ranks, suits } from "./types.js";

const imageKeys: Record<Suit, string> = {
  sticks: "bastos",
  cups: "copas",
  swords: "espadas",
  gold: "oros",
};

const cardImageExt = process.env.CARD_IMAGE_EXT ?? "png";

export function createDeck(): Card[] {
  return suits.flatMap((suit) =>
    ranks.map((rank) => {
      const imageKey = `${imageKeys[suit]}-${rank}`;

      return {
        id: imageKey,
        suit,
        rank: rank as Rank,
        imageKey,
        imagePath: `/cards/${imageKey}.${cardImageExt}`,
      };
    }),
  );
}

export function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function drawCards(deck: Card[], count: number): Card[] {
  return deck.splice(0, count);
}
