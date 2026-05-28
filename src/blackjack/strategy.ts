import { dealerUpcardValue, rankValue } from "./cards";
import { isPair, scoreHand } from "./hand";
import type { Card, PlayerAction, StrategyAdvice, TableRules } from "./types";

type Context = {
  cards: Card[];
  dealerUpcard: Card;
  rules: TableRules;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
};

const actionLabel: Record<PlayerAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
  insurance: "Decline insurance",
};

export function getStrategyAdvice(context: Context): StrategyAdvice {
  const dealer = dealerUpcardValue(context.dealerUpcard);
  const cards = context.cards;

  if (context.canSurrender) {
    const surrenderAction = surrenderStrategy(cards, dealer, context.rules);
    if (surrenderAction) return advice(surrenderAction, "This is one of the few spots where giving up half beats playing the whole hand.");
  }

  if (context.canSplit && isPair(cards)) {
    const splitAction = pairStrategy(cards, dealer, context.rules);
    if (splitAction === "split") return advice("split", "Splitting creates two stronger starting hands against this dealer card.");
  }

  const value = scoreHand(cards);
  if (value.soft && cards.some((card) => card.rank === "A") && value.total <= 21) {
    return advice(softStrategy(value.total, dealer, context), "Soft hands can improve without immediately busting, so doubles appear in specific dealer spots.");
  }

  return advice(hardStrategy(value.total, dealer, context), "Hard totals are played by comparing your bust risk against the dealer's upcard.");
}

export function insuranceAdvice(): StrategyAdvice {
  return {
    action: "insurance",
    label: "Decline insurance",
    reason: "Basic strategy declines insurance and even money without a card-counting edge.",
  };
}

function surrenderStrategy(cards: Card[], dealer: number, rules: TableRules): PlayerAction | null {
  if (!rules.surrender || cards.length !== 2) return null;
  const total = scoreHand(cards).total;
  if (total === 16 && [9, 10, 11].includes(dealer)) return "surrender";
  if (total === 15 && dealer === 10) return "surrender";
  if (rules.dealerHitsSoft17 && total === 15 && dealer === 11) return "surrender";
  if (rules.dealerHitsSoft17 && total === 17 && dealer === 11) return "surrender";
  return null;
}

function pairStrategy(cards: Card[], dealer: number, rules: TableRules): PlayerAction {
  const pairValue = rankValue(cards[0].rank);

  if (cards[0].rank === "A" || pairValue === 8) return "split";
  if (pairValue === 10) return "stand";
  if (pairValue === 9) return [2, 3, 4, 5, 6, 8, 9].includes(dealer) ? "split" : "stand";
  if (pairValue === 7) return dealer >= 2 && dealer <= 7 ? "split" : "hit";
  if (pairValue === 6) {
    if (dealer >= 2 && dealer <= 6) return rules.doubleAfterSplit ? "split" : dealer === 2 ? "hit" : "split";
    return "hit";
  }
  if (pairValue === 5) return hardStrategy(10, dealer, { canDouble: true } as Context);
  if (pairValue === 4) return rules.doubleAfterSplit && [5, 6].includes(dealer) ? "split" : "hit";
  if (pairValue === 3 || pairValue === 2) return dealer >= 2 && dealer <= 7 ? "split" : "hit";

  return "hit";
}

function softStrategy(total: number, dealer: number, context: Context): PlayerAction {
  const canDouble = context.canDouble;
  if (total <= 17) {
    if (canDouble && total >= 13 && total <= 14 && [5, 6].includes(dealer)) return "double";
    if (canDouble && total >= 15 && total <= 16 && dealer >= 4 && dealer <= 6) return "double";
    if (canDouble && total === 17 && dealer >= 3 && dealer <= 6) return "double";
    return "hit";
  }

  if (total === 18) {
    if (canDouble && dealer >= 3 && dealer <= 6) return "double";
    if (context.rules.dealerHitsSoft17 && canDouble && dealer === 2) return "double";
    if ([2, 7, 8].includes(dealer)) return "stand";
    return "hit";
  }

  if (total === 19) {
    if (context.rules.dealerHitsSoft17 && canDouble && dealer === 6) return "double";
    return "stand";
  }

  return "stand";
}

function hardStrategy(total: number, dealer: number, context: Pick<Context, "canDouble">): PlayerAction {
  const canDouble = context.canDouble;
  if (total <= 8) return "hit";
  if (total === 9) return canDouble && dealer >= 3 && dealer <= 6 ? "double" : "hit";
  if (total === 10) return canDouble && dealer >= 2 && dealer <= 9 ? "double" : "hit";
  if (total === 11) return canDouble && dealer !== 11 ? "double" : "hit";
  if (total === 12) return dealer >= 4 && dealer <= 6 ? "stand" : "hit";
  if (total >= 13 && total <= 16) return dealer >= 2 && dealer <= 6 ? "stand" : "hit";
  return "stand";
}

function advice(action: PlayerAction, reason: string): StrategyAdvice {
  return {
    action,
    label: actionLabel[action],
    reason,
  };
}
