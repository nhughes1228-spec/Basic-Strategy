import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { createInitialState, playerAction, revealTip, setBet, startRound, takeInsurance } from "./game";
import { defaultRules } from "./rules";

describe("game flow", () => {
  it("deals a round and debits the bet", () => {
    const filler = Array.from({ length: 100 }, (_, index) => makeCard("2", "C", `deal-filler-${index}`));
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      shoe: [makeCard("9"), makeCard("6"), makeCard("7"), makeCard("10"), ...filler],
    };
    const next = startRound(state, defaultRules);

    expect(next.hands).toHaveLength(1);
    expect(next.hands[0].cards).toHaveLength(2);
    expect(next.dealer).toHaveLength(2);
    expect(next.bankroll).toBe(975);
  });

  it("awards a training point for a correct decision", () => {
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      phase: "player" as const,
      bankroll: 975,
      dealer: [makeCard("6"), makeCard("10")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("10"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = playerAction(state, defaultRules, "stand");
    expect(next.trainingPoints).toBe(1);
    expect(next.feedback[0]).toMatchObject({ correct: true, awardedPoint: true });
  });

  it("falls back from double to hit when the player cannot afford to double", () => {
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      phase: "player" as const,
      bankroll: 0,
      dealer: [makeCard("10"), makeCard("7")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("5"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = playerAction(state, defaultRules, "hit");
    expect(next.trainingPoints).toBe(1);
    expect(next.feedback[0]).toMatchObject({ correct: true, expected: "hit" });
  });

  it("falls back from split to stand when the player cannot afford to split", () => {
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      phase: "player" as const,
      bankroll: 0,
      dealer: [makeCard("6"), makeCard("10")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("8"), makeCard("8", "H")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = playerAction(state, defaultRules, "stand");
    expect(next.trainingPoints).toBe(1);
    expect(next.feedback[0]).toMatchObject({ correct: true, expected: "stand" });
  });

  it("does not award a point when a tip was used", () => {
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      phase: "player" as const,
      bankroll: 975,
      dealer: [makeCard("6"), makeCard("10")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("10"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: false,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = playerAction(state, defaultRules, "stand");
    expect(next.trainingPoints).toBe(0);
    expect(next.feedback[0]).toMatchObject({ correct: true, awardedPoint: false });
  });

  it("settles a 6:5 blackjack payout", () => {
    const state = {
      ...setBet(createInitialState(defaultRules), 25),
      shoe: [],
      bankroll: 975,
      dealer: [makeCard("9"), makeCard("7")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("A"), makeCard("K")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const filler = Array.from({ length: 100 }, (_, index) => makeCard("2", "C", `filler-${index}`));
    const next = startRound({ ...state, shoe: [makeCard("A"), makeCard("9"), makeCard("K"), makeCard("7"), ...filler] }, defaultRules);
    expect(next.phase).toBe("settled");
    expect(next.hands[0].outcome).toBe("blackjack");
    expect(next.bankroll).toBe(1005);
  });

  it("declining insurance is the correct strategy decision", () => {
    const state = {
      ...createInitialState(defaultRules),
      phase: "insurance" as const,
      bankroll: 975,
      dealer: [makeCard("A"), makeCard("7")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("10"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = takeInsurance(state, defaultRules, false);
    expect(next.trainingPoints).toBe(1);
    expect(next.feedback[0]).toMatchObject({ correct: true });
  });

  it("taking insurance gets clear miss feedback", () => {
    const state = {
      ...createInitialState(defaultRules),
      phase: "insurance" as const,
      bankroll: 975,
      dealer: [makeCard("A"), makeCard("7")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("10"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const next = takeInsurance(state, defaultRules, true);
    expect(next.feedback[0]).toMatchObject({ correct: false });
    expect(next.feedback[0].message).toBe("Basic strategy called for decline insurance, not take insurance.");
  });

  it("forfeits the insurance point after using a tip", () => {
    const state = {
      ...createInitialState(defaultRules),
      phase: "insurance" as const,
      bankroll: 975,
      dealer: [makeCard("A"), makeCard("7")],
      hands: [
        {
          id: "hand",
          cards: [makeCard("10"), makeCard("6")],
          bet: 25,
          status: "active" as const,
          splitDepth: 0,
          canEarnStrategyPoint: true,
          decisionCount: 0,
          correctDecisionCount: 0,
          outcome: "pending" as const,
          payout: 0,
        },
      ],
    };

    const tipped = revealTip(state, defaultRules);
    const next = takeInsurance(tipped, defaultRules, false);
    expect(next.trainingPoints).toBe(0);
    expect(next.feedback[0]).toMatchObject({ correct: true, awardedPoint: false });
  });
});
