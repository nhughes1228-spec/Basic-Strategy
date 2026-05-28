import type { TableRules } from "./types";

export const defaultRules: TableRules = {
  deckCount: 6,
  dealerHitsSoft17: true,
  insurance: true,
  blackjackPayout: "6:5",
  doubleAfterSplit: true,
  surrender: false,
  resplitLimit: 3,
  cutCardPenetration: 0.75,
};

export function blackjackMultiplier(payout: TableRules["blackjackPayout"]): number {
  if (payout === "3:2") return 1.5;
  if (payout === "6:5") return 1.2;
  return 1;
}

export function rulesSummary(rules: TableRules): string {
  return [
    `${rules.deckCount}D`,
    rules.dealerHitsSoft17 ? "H17" : "S17",
    rules.doubleAfterSplit ? "DAS" : "No DAS",
    rules.insurance ? "Insurance" : "No insurance",
    rules.surrender ? "Late surrender" : "No surrender",
    `BJ ${rules.blackjackPayout}`,
  ].join(" · ");
}
