export type Suit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type Card = {
  rank: Rank;
  suit: Suit;
  id: string;
};

export type PlayerAction = "hit" | "stand" | "double" | "split" | "surrender" | "insurance";

export type BlackjackPayout = "3:2" | "6:5" | "1:1";

export type TableRules = {
  deckCount: number;
  dealerHitsSoft17: boolean;
  insurance: boolean;
  blackjackPayout: BlackjackPayout;
  doubleAfterSplit: boolean;
  surrender: boolean;
  resplitLimit: number;
  cutCardPenetration: number;
};

export type HandStatus = "active" | "stood" | "busted" | "doubled" | "surrendered" | "settled";

export type HandOutcome = "win" | "lose" | "push" | "blackjack" | "surrender" | "bust" | "pending";

export type PlayerHand = {
  id: string;
  cards: Card[];
  bet: number;
  status: HandStatus;
  splitDepth: number;
  canEarnStrategyPoint: boolean;
  decisionCount: number;
  correctDecisionCount: number;
  lastAdvice?: StrategyAdvice;
  outcome: HandOutcome;
  payout: number;
};

export type StrategyAdvice = {
  action: PlayerAction;
  label: string;
  reason: string;
};

export type FeedbackEntry = {
  id: string;
  handId: string;
  action: PlayerAction;
  expected: PlayerAction;
  correct: boolean;
  awardedPoint: boolean;
  message: string;
};

export type RoundPhase = "betting" | "insurance" | "player" | "dealer" | "settled";

export type RoundState = {
  shoe: Card[];
  discard: Card[];
  dealer: Card[];
  hands: PlayerHand[];
  activeHandIndex: number;
  phase: RoundPhase;
  bankroll: number;
  bet: number;
  trainingPoints: number;
  feedback: FeedbackEntry[];
  message: string;
  insuranceBet: number;
  roundNumber: number;
};
