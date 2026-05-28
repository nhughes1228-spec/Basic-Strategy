import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { scoreHand } from "./hand";

describe("scoreHand", () => {
  it("scores blackjack", () => {
    expect(scoreHand([makeCard("A"), makeCard("K")])).toMatchObject({
      total: 21,
      soft: true,
      busted: false,
      blackjack: true,
    });
  });

  it("converts aces from eleven to one to avoid busting", () => {
    expect(scoreHand([makeCard("A"), makeCard("9"), makeCard("8")])).toMatchObject({
      total: 18,
      soft: false,
      busted: false,
    });
  });

  it("flags hard busts", () => {
    expect(scoreHand([makeCard("10"), makeCard("9"), makeCard("5")])).toMatchObject({
      total: 24,
      busted: true,
    });
  });
});
