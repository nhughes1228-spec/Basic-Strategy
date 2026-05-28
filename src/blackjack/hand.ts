import { rankValue } from "./cards";
import type { Card } from "./types";

export type HandValue = {
  total: number;
  soft: boolean;
  busted: boolean;
  blackjack: boolean;
};

export function scoreHand(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === "A") aces += 1;
  }

  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  return {
    total,
    soft: softAces > 0,
    busted: total > 21,
    blackjack: cards.length === 2 && total === 21,
  };
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

export function canSplitAces(cards: Card[]): boolean {
  return cards.length === 2 && cards[0].rank === "A" && cards[1].rank === "A";
}
