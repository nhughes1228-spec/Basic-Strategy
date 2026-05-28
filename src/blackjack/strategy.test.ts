import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { defaultRules } from "./rules";
import { getStrategyAdvice, insuranceAdvice } from "./strategy";

describe("getStrategyAdvice", () => {
  it("declines insurance under basic strategy", () => {
    expect(insuranceAdvice()).toMatchObject({ action: "insurance" });
  });

  it("doubles hard 11 against dealer 10", () => {
    expect(
      getStrategyAdvice({
        cards: [makeCard("5"), makeCard("6")],
        dealerUpcard: makeCard("10"),
        rules: defaultRules,
        canDouble: true,
        canSplit: false,
        canSurrender: false,
      }).action,
    ).toBe("double");
  });

  it("changes soft 18 vs dealer 2 between H17 and S17", () => {
    const h17 = getStrategyAdvice({
      cards: [makeCard("A"), makeCard("7")],
      dealerUpcard: makeCard("2"),
      rules: { ...defaultRules, dealerHitsSoft17: true },
      canDouble: true,
      canSplit: false,
      canSurrender: false,
    }).action;
    const s17 = getStrategyAdvice({
      cards: [makeCard("A"), makeCard("7")],
      dealerUpcard: makeCard("2"),
      rules: { ...defaultRules, dealerHitsSoft17: false },
      canDouble: true,
      canSplit: false,
      canSurrender: false,
    }).action;

    expect(h17).toBe("double");
    expect(s17).toBe("stand");
  });

  it("uses surrender only when the rule is enabled", () => {
    const cards = [makeCard("10"), makeCard("6")];
    const dealerUpcard = makeCard("10");
    expect(
      getStrategyAdvice({
        cards,
        dealerUpcard,
        rules: { ...defaultRules, surrender: true },
        canDouble: true,
        canSplit: false,
        canSurrender: true,
      }).action,
    ).toBe("surrender");
    expect(
      getStrategyAdvice({
        cards,
        dealerUpcard,
        rules: { ...defaultRules, surrender: false },
        canDouble: true,
        canSplit: false,
        canSurrender: true,
      }).action,
    ).toBe("hit");
  });
});
