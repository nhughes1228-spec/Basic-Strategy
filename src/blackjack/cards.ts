import type { Card, Rank, Suit } from "./types";

export const suits: Suit[] = ["S", "H", "D", "C"];
export const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createShoe(deckCount: number): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < deckCount; deck += 1) {
    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push({ rank, suit, id: `${deck}-${rank}${suit}` });
      }
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function cardCode(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["10", "J", "Q", "K"].includes(rank)) return 10;
  return Number(rank);
}

export function dealerUpcardValue(card: Card): number {
  return rankValue(card.rank);
}

export function makeCard(rank: Rank, suit: Suit = "S", id = `${rank}${suit}`): Card {
  return { rank, suit, id };
}
