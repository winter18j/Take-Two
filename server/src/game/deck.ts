import { Card, ModifierKind, Rank, RoomRules, Suit, ranks, suits } from "./types.js";

const imageKeys: Record<Suit, string> = {
  sticks: "bastos",
  cups: "copas",
  swords: "espadas",
  gold: "oros",
};

const cardImageExt = process.env.CARD_IMAGE_EXT ?? "png";

const modifierCards: Array<{ imageKey: string; modifier: ModifierKind; rank: Rank }> = [
  { imageKey: "mod_timer", modifier: "timer_five", rank: 5 },
  { imageKey: "mod_15", modifier: "draw_one_half", rank: 10 },
  { imageKey: "mod_05", modifier: "draw_half", rank: 11 },
  { imageKey: "mod_skip", modifier: "skip_ability", rank: 12 },
  { imageKey: "mod_choose3", modifier: "choose_three", rank: 3 },
];

export function createDeck(rules?: Partial<RoomRules>): Card[] {
  const playingCards = suits.flatMap((suit) =>
    ranks.map((rank) => {
      const imageKey = `${imageKeys[suit]}-${rank}`;

      return {
        id: imageKey,
        type: "playing" as const,
        suit,
        rank: rank as Rank,
        imageKey,
        imagePath: `/cards/${imageKey}.${cardImageExt}`,
      };
    }),
  );

  const specialCards: Card[] = [];
  if (rules?.skipOwnTurnCard) {
    specialCards.push(...[0, 1].map((index) => ({
      id: `skip-turn-${index + 1}`,
      type: "skip_turn" as const,
      suit: "gold" as Suit,
      rank: 10 as Rank,
      imageKey: "special_skip",
      imagePath: "/cards/special_skip.png",
    })));
  }
  if (rules?.modifierCards) {
    specialCards.push(...modifierCards.map((card, index) => ({
      id: `${card.imageKey}-${index + 1}`,
      type: "modifier" as const,
      suit: "gold" as Suit,
      rank: card.rank,
      imageKey: card.imageKey,
      imagePath: `/cards/${card.imageKey}.png`,
      modifier: card.modifier,
    })));
  }

  return [...playingCards, ...specialCards];
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
