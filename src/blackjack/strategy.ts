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
    if (surrenderAction) return advice(surrenderAction, surrenderReason(scoreHand(cards).total, dealer, context.rules));
  }

  if (context.canSplit && isPair(cards)) {
    const splitAction = pairStrategy(cards, dealer, context.rules);
    if (splitAction === "split") return advice("split", pairReason(cards, dealer, context.rules));
  }

  const value = scoreHand(cards);
  if (value.soft && cards.some((card) => card.rank === "A") && value.total <= 21) {
    const action = softStrategy(value.total, dealer, context);
    return advice(action, softReason(value.total, action, context));
  }

  const action = hardStrategy(value.total, dealer, context);
  return advice(action, hardReason(value.total, action, context));
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

function surrenderReason(total: number, dealer: number, rules: TableRules): string {
  const dealerName = dealerLabel(dealer);
  if (total === 15 && dealer === 11 && rules.dealerHitsSoft17) return "You should surrender hard 15 against a dealer ace when the dealer hits soft 17; keeping the hand loses more than giving up half the bet.";
  if (total === 17 && dealer === 11 && rules.dealerHitsSoft17) return "You should surrender hard 17 against a dealer ace when the dealer hits soft 17; the ace is strong enough that surrender saves more money long-term.";
  if (total === 15) return `You should surrender hard 15 against a dealer ${dealerName}; this is one of the few totals where giving up half beats playing the hand.`;
  return `You should surrender hard 16 against a dealer ${dealerName}; that total is too bust-prone against the dealer's strongest upcards.`;
}

function pairReason(cards: Card[], dealer: number, rules: TableRules): string {
  const pairValue = rankValue(cards[0].rank);
  if (cards[0].rank === "A") return "You should always split aces; two starting hands that begin with an ace are much stronger than one soft 12.";
  if (pairValue === 8) return "You should always split 8s; hard 16 is a weak hand, and splitting gives each 8 a chance to build a playable total.";
  if (pairValue === 9) return "You should split 9s when the dealer shows 2, 3, 4, 5, 6, 8, or 9, but stand against 7, 10, or ace.";
  if (pairValue === 7) return "You should split 7s when the dealer shows 2 through 7 because the dealer is more likely to finish weak or bust.";
  if (pairValue === 6) {
    return rules.doubleAfterSplit
      ? "You should split 6s when the dealer shows 2 through 6 because double-after-split makes the new hands more valuable."
      : "You should split 6s against dealer 3 through 6, but hit against 2 when double-after-split is not allowed.";
  }
  if (pairValue === 4) return "You should split 4s only against dealer 5 or 6 when double-after-split is allowed; those are the dealer's weakest upcards.";
  return "You should split 2s and 3s when the dealer shows 2 through 7 because two small starting hands perform better than one weak total.";
}

function softReason(total: number, action: PlayerAction, context: Context): string {
  const h17 = context.rules.dealerHitsSoft17;
  if (total <= 14) {
    if (action === "double") return "You should double soft 13 or soft 14 when the dealer is showing a 5 or 6.";
    return context.canDouble
      ? "You should hit soft 13 or soft 14 unless the dealer is showing a 5 or 6."
      : "You should hit soft 13 or soft 14 here; the hand is too small to stand, and doubling is not available now.";
  }

  if (total <= 16) {
    if (action === "double") return "You should double soft 15 or soft 16 when the dealer is showing a 4, 5, or 6.";
    return context.canDouble
      ? "You should hit soft 15 or soft 16 unless the dealer is showing a 4, 5, or 6."
      : "You should hit soft 15 or soft 16 here; the ace keeps the hand flexible, and doubling is not available now.";
  }

  if (total === 17) {
    if (action === "double") return "You should double soft 17 when the dealer is showing a 3, 4, 5, or 6.";
    return context.canDouble
      ? "You should hit soft 17 unless the dealer is showing a 3, 4, 5, or 6."
      : "You should hit soft 17 here; it is not strong enough to stand, and doubling is not available now.";
  }

  if (total === 18) {
    if (action === "double") {
      const dealerRange = h17 ? "2, 3, 4, 5, or 6" : "3, 4, 5, or 6";
      return `You should double when you have a soft 18 and the dealer is showing a ${dealerRange}.`;
    }
    if (action === "stand") {
      return h17 && !context.canDouble
        ? "You should stand on soft 18 against dealer 2, 7, or 8 when doubling is not available."
        : "You should stand on soft 18 when the dealer is showing a 2, 7, or 8.";
    }
    return "You should hit soft 18 when the dealer is showing a 9, 10, or ace.";
  }

  if (total === 19) {
    if (action === "double") return "You should double soft 19 against dealer 6 when the dealer hits soft 17.";
    return "You should stand on soft 19; the hand is already strong enough to keep.";
  }

  return "You should stand on soft 20 or 21; the hand is already too strong to risk changing.";
}

function hardReason(total: number, action: PlayerAction, context: Pick<Context, "canDouble">): string {
  if (action === "double") {
    if (total === 9) return "You should double hard 9 when the dealer is showing a 3, 4, 5, or 6.";
    if (total === 10) return "You should double hard 10 when the dealer is showing 2 through 9.";
    if (total === 11) return "You should double hard 11 against any dealer upcard except an ace.";
  }

  if (total <= 8) return "You should hit hard 8 or less because the hand is too small to stand.";
  if (total === 9) return context.canDouble ? "You should hit hard 9 unless the dealer is showing a 3, 4, 5, or 6." : "You should hit hard 9 here; doubling is not available now.";
  if (total === 10) return context.canDouble ? "You should hit hard 10 against dealer 10 or ace, and double against 2 through 9." : "You should hit hard 10 here; doubling is not available now.";
  if (total === 11) return context.canDouble ? "You should hit hard 11 against a dealer ace, and double against every other upcard." : "You should hit hard 11 here; doubling is not available now.";
  if (total === 12) return action === "stand" ? "You should stand on hard 12 when the dealer is showing a 4, 5, or 6." : "You should hit hard 12 against dealer 2, 3, 7, 8, 9, 10, or ace.";
  if (total >= 13 && total <= 16) return action === "stand" ? "You should stand on hard 13 through 16 when the dealer is showing 2 through 6." : "You should hit hard 13 through 16 when the dealer is showing 7 or higher.";
  return "You should stand on hard 17 or higher; the total is strong enough and hitting risks busting.";
}

function dealerLabel(dealer: number): string {
  if (dealer === 11) return "ace";
  return String(dealer);
}

function advice(action: PlayerAction, reason: string): StrategyAdvice {
  return {
    action,
    label: actionLabel[action],
    reason,
  };
}
