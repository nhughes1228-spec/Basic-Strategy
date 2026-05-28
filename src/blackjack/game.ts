import { createShoe } from "./cards";
import { scoreHand } from "./hand";
import { blackjackMultiplier, defaultRules } from "./rules";
import { getStrategyAdvice, insuranceAdvice } from "./strategy";
import type { Card, FeedbackEntry, PlayerAction, PlayerHand, RoundState, TableRules } from "./types";

let idCounter = 0;

export function createInitialState(rules: TableRules = defaultRules): RoundState {
  return {
    shoe: createShoe(rules.deckCount),
    discard: [],
    dealer: [],
    hands: [],
    activeHandIndex: 0,
    phase: "betting",
    bankroll: 1000,
    bet: 0,
    trainingPoints: 0,
    feedback: [],
    message: "Place your bet to begin.",
    insuranceBet: 0,
    roundNumber: 0,
  };
}

export function startRound(state: RoundState, rules: TableRules): RoundState {
  const bet = clampBet(state.bet, state.bankroll);
  let shoe = state.shoe;
  let discard = state.discard;
  if (shoe.length < rules.deckCount * 52 * (1 - rules.cutCardPenetration)) {
    shoe = createShoe(rules.deckCount);
    discard = [];
  }

  const dealt = drawMany(shoe, 4);
  const playerCards = [dealt.cards[0], dealt.cards[2]];
  const dealer = [dealt.cards[1], dealt.cards[3]];
  const hand: PlayerHand = newHand(playerCards, bet, 0);
  const playerBlackjack = scoreHand(playerCards).blackjack;
  const dealerBlackjack = scoreHand(dealer).blackjack;

  const next: RoundState = {
    ...state,
    shoe: dealt.shoe,
    discard,
    dealer,
    hands: [hand],
    activeHandIndex: 0,
    phase: rules.insurance && dealer[0].rank === "A" && !playerBlackjack ? "insurance" : "player",
    bankroll: state.bankroll - bet,
    feedback: [],
    insuranceBet: 0,
    message: "Choose the basic-strategy play.",
    roundNumber: state.roundNumber + 1,
  };

  if (playerBlackjack || dealerBlackjack) {
    return settleRound(next, rules);
  }

  return next;
}

export function setBet(state: RoundState, bet: number): RoundState {
  if (state.phase !== "betting") return state;
  return { ...state, bet: clampBet(bet, state.bankroll) };
}

export function resetBankroll(state: RoundState, bankroll = 1000): RoundState {
  return {
    ...state,
    bankroll,
    bet: 0,
    dealer: [],
    hands: [],
    activeHandIndex: 0,
    phase: "betting",
    insuranceBet: 0,
    message: "Bankroll reset. Place your bet to begin.",
  };
}

export function resetTraining(state: RoundState): RoundState {
  return { ...state, trainingPoints: 0, feedback: [], message: "Training points reset." };
}

export function revealTip(state: RoundState, rules: TableRules): RoundState {
  if (state.phase === "insurance") {
    return {
      ...state,
      hands: state.hands.map((hand, index) => (index === 0 ? { ...hand, canEarnStrategyPoint: false, lastAdvice: insuranceAdvice() } : hand)),
      message: insuranceAdvice().reason,
    };
  }
  if (state.phase !== "player") return state;
  const hand = state.hands[state.activeHandIndex];
  const legalActions = allowedActions(state, rules);
  const advice = adviceForHand(hand, state.dealer[0], rules, legalActions);
  const hands = state.hands.map((candidate) =>
    candidate.id === hand.id ? { ...candidate, canEarnStrategyPoint: false, lastAdvice: advice } : candidate,
  );
  return { ...state, hands, message: `${advice.label}: ${advice.reason}` };
}

export function takeInsurance(state: RoundState, rules: TableRules, accepted: boolean): RoundState {
  if (state.phase !== "insurance") return state;
  const expected = insuranceAdvice();
  const insuranceBet = accepted ? Math.min(state.hands[0].bet / 2, state.bankroll) : 0;
  const base = {
    ...state,
    bankroll: state.bankroll - insuranceBet,
    insuranceBet,
    phase: "player" as const,
  };
  const withFeedback = recordDecision(base, state.hands[0], "insurance", expected.action, state.hands[0].canEarnStrategyPoint, rules, {
    forceCorrect: !accepted,
    actionLabel: accepted ? "take insurance" : "decline insurance",
    expectedLabel: "decline insurance",
  });

  if (scoreHand(state.dealer).blackjack) return settleRound(withFeedback, rules);
  return { ...withFeedback, message: accepted ? "Insurance placed. Dealer does not have blackjack." : "Insurance declined. Play the hand." };
}

export function playerAction(state: RoundState, rules: TableRules, action: Exclude<PlayerAction, "insurance">): RoundState {
  if (state.phase !== "player") return state;
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.status !== "active") return state;

  const allowed = allowedActions(state, rules);
  if (!allowed.includes(action)) return { ...state, message: `${action} is not available for this hand.` };

  const advice = adviceForHand(hand, state.dealer[0], rules, allowed);
  let next = recordDecision(state, hand, action, advice.action, hand.canEarnStrategyPoint, rules);

  if (action === "hit") next = hitHand(next, rules, false);
  if (action === "stand") next = updateActiveHand(next, { status: "stood" });
  if (action === "double") next = doubleHand(next, rules);
  if (action === "split") next = splitHand(next, rules);
  if (action === "surrender") next = updateActiveHand(next, { status: "surrendered", outcome: "surrender" });

  return advanceTurn(next, rules);
}

export function allowedActions(state: RoundState, rules: TableRules): PlayerAction[] {
  if (state.phase === "insurance") return ["insurance"];
  if (state.phase !== "player") return [];
  const hand = state.hands[state.activeHandIndex];
  if (!hand || hand.status !== "active") return [];

  const actions: PlayerAction[] = ["hit", "stand"];
  const isInitial = hand.cards.length === 2;
  const hasFunds = state.bankroll >= hand.bet;
  if (isInitial && hasFunds) actions.push("double");
  if (isInitial && hasFunds && hand.cards.length === 2 && scoreHand(hand.cards).total !== 21) {
    const [first, second] = hand.cards;
    const sameValue = first.rank === second.rank || (["10", "J", "Q", "K"].includes(first.rank) && ["10", "J", "Q", "K"].includes(second.rank));
    if (sameValue && hand.splitDepth < rules.resplitLimit) actions.push("split");
  }
  if (isInitial && rules.surrender && hand.splitDepth === 0) actions.push("surrender");
  return actions;
}

function hitHand(state: RoundState, rules: TableRules, doubled: boolean): RoundState {
  const drawn = drawMany(state.shoe, 1);
  const hand = state.hands[state.activeHandIndex];
  const cards = [...hand.cards, drawn.cards[0]];
  const value = scoreHand(cards);
  const status = value.busted ? "busted" : doubled ? "doubled" : "active";
  const outcome = value.busted ? "bust" : hand.outcome;
  return {
    ...updateActiveHand({ ...state, shoe: drawn.shoe }, { cards, status, outcome }),
    message: value.busted ? "Bust. The hand is over." : doubled ? "Double card dealt." : "Card dealt.",
  };
}

function doubleHand(state: RoundState, rules: TableRules): RoundState {
  const hand = state.hands[state.activeHandIndex];
  const debited = { ...state, bankroll: state.bankroll - hand.bet };
  const doubled = updateActiveHand(debited, { bet: hand.bet * 2 });
  return hitHand(doubled, rules, true);
}

function splitHand(state: RoundState, rules: TableRules): RoundState {
  const hand = state.hands[state.activeHandIndex];
  const drawn = drawMany(state.shoe, 2);
  const first = newHand([hand.cards[0], drawn.cards[0]], hand.bet, hand.splitDepth + 1);
  const second = newHand([hand.cards[1], drawn.cards[1]], hand.bet, hand.splitDepth + 1);
  const hands = [...state.hands];
  hands.splice(state.activeHandIndex, 1, first, second);

  return {
    ...state,
    shoe: drawn.shoe,
    hands,
    bankroll: state.bankroll - hand.bet,
    message: "Pair split. Play the first hand.",
  };
}

function advanceTurn(state: RoundState, rules: TableRules): RoundState {
  const current = state.hands[state.activeHandIndex];
  if (current?.status === "active") return state;

  const nextIndex = state.hands.findIndex((hand, index) => index > state.activeHandIndex && hand.status === "active");
  if (nextIndex >= 0) return { ...state, activeHandIndex: nextIndex, message: "Play the next hand." };

  const anyLiveHands = state.hands.some((hand) => !["busted", "surrendered"].includes(hand.status));
  if (!anyLiveHands) return settleRound({ ...state, phase: "settled" }, rules);

  return settleRound(playDealer({ ...state, phase: "dealer" }, rules), rules);
}

function playDealer(state: RoundState, rules: TableRules): RoundState {
  let shoe = state.shoe;
  const dealer = [...state.dealer];
  while (true) {
    const value = scoreHand(dealer);
    if (value.total > 17) break;
    if (value.total === 17 && (!value.soft || !rules.dealerHitsSoft17)) break;
    const drawn = drawMany(shoe, 1);
    dealer.push(drawn.cards[0]);
    shoe = drawn.shoe;
  }
  return { ...state, shoe, dealer };
}

function settleRound(state: RoundState, rules: TableRules): RoundState {
  const dealerValue = scoreHand(state.dealer);
  let bankroll = state.bankroll;
  let discard = [...state.discard, ...state.dealer];

  if (state.insuranceBet > 0 && dealerValue.blackjack) bankroll += state.insuranceBet * 3;

  const hands = state.hands.map((hand) => {
    const playerValue = scoreHand(hand.cards);
    let outcome = hand.outcome;
    let payout = 0;

    if (hand.status === "surrendered") {
      outcome = "surrender";
      payout = hand.bet / 2;
    } else if (playerValue.busted) {
      outcome = "bust";
    } else if (playerValue.blackjack && !dealerValue.blackjack && hand.splitDepth === 0) {
      outcome = "blackjack";
      payout = hand.bet + hand.bet * blackjackMultiplier(rules.blackjackPayout);
    } else if (dealerValue.blackjack && !playerValue.blackjack) {
      outcome = "lose";
    } else if (dealerValue.blackjack && playerValue.blackjack) {
      outcome = "push";
      payout = hand.bet;
    } else if (dealerValue.busted || playerValue.total > dealerValue.total) {
      outcome = "win";
      payout = hand.bet * 2;
    } else if (playerValue.total === dealerValue.total) {
      outcome = "push";
      payout = hand.bet;
    } else {
      outcome = "lose";
    }

    bankroll += payout;
    discard = [...discard, ...hand.cards];
    return { ...hand, status: "settled" as const, outcome, payout };
  });

  return {
    ...state,
    discard,
    hands,
    bankroll,
    phase: "settled",
    message: summarizeSettlement(hands, dealerValue.busted),
  };
}

function recordDecision(
  state: RoundState,
  hand: PlayerHand,
  action: PlayerAction,
  expected: PlayerAction,
  canAward: boolean,
  rules: TableRules,
  options?: { forceCorrect?: boolean; forceAward?: boolean; actionLabel?: string; expectedLabel?: string },
): RoundState {
  const correct = options?.forceCorrect ?? action === expected;
  const awardedPoint = correct && (options?.forceAward ?? canAward);
  const expectedLabel = options?.expectedLabel ?? label(expected);
  const actionLabel = options?.actionLabel ?? label(action);
  const feedback: FeedbackEntry = {
    id: `feedback-${idCounter += 1}`,
    handId: hand.id,
    action,
    expected,
    correct,
    awardedPoint,
    message: correct ? `Correct: ${expectedLabel}.` : `Basic strategy called for ${expectedLabel}, not ${actionLabel}.`,
  };
  const hands = state.hands.map((candidate) =>
    candidate.id === hand.id
      ? {
          ...candidate,
          decisionCount: candidate.decisionCount + 1,
          correctDecisionCount: candidate.correctDecisionCount + (correct ? 1 : 0),
          lastAdvice: adviceForHand(candidate, state.dealer[0], rules),
        }
      : candidate,
  );
  return {
    ...state,
    hands,
    trainingPoints: state.trainingPoints + (awardedPoint ? 1 : 0),
    feedback: [feedback, ...state.feedback].slice(0, 8),
    message: feedback.message,
  };
}

function adviceForHand(hand: PlayerHand, dealerUpcard: Card, rules: TableRules, legalActions?: PlayerAction[]) {
  return getStrategyAdvice({
    cards: hand.cards,
    dealerUpcard,
    rules,
    canDouble: legalActions ? legalActions.includes("double") : hand.cards.length === 2,
    canSplit: legalActions ? legalActions.includes("split") : hand.cards.length === 2,
    canSurrender: legalActions ? legalActions.includes("surrender") : hand.cards.length === 2 && hand.splitDepth === 0,
  });
}

function updateActiveHand(state: RoundState, updates: Partial<PlayerHand>): RoundState {
  return {
    ...state,
    hands: state.hands.map((hand, index) => (index === state.activeHandIndex ? { ...hand, ...updates } : hand)),
  };
}

function drawMany(shoe: Card[], count: number): { cards: Card[]; shoe: Card[] } {
  return {
    cards: shoe.slice(0, count),
    shoe: shoe.slice(count),
  };
}

function newHand(cards: Card[], bet: number, splitDepth: number): PlayerHand {
  return {
    id: `hand-${idCounter += 1}`,
    cards,
    bet,
    status: "active",
    splitDepth,
    canEarnStrategyPoint: true,
    decisionCount: 0,
    correctDecisionCount: 0,
    outcome: "pending",
    payout: 0,
  };
}

function clampBet(bet: number, bankroll: number): number {
  return Math.max(0, Math.min(bankroll, Math.round(bet)));
}

function label(action: PlayerAction): string {
  if (action === "hit") return "hit";
  if (action === "stand") return "stand";
  if (action === "double") return "double";
  if (action === "split") return "split";
  if (action === "surrender") return "surrender";
  return "decline insurance";
}

function summarizeSettlement(hands: PlayerHand[], dealerBusted: boolean): string {
  const outcomes = hands.map((hand) => hand.outcome);
  if (outcomes.includes("blackjack")) return "Blackjack paid. Round settled.";
  if (dealerBusted) return "Dealer busts. Round settled.";
  if (outcomes.every((outcome) => ["lose", "bust", "surrender"].includes(outcome))) return "Round settled. The house takes this one.";
  if (outcomes.some((outcome) => outcome === "win")) return "Round settled. Nice win.";
  return "Round settled.";
}
