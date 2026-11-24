import { describe, expect, it } from "vitest";
import { cardFlipPays, cardFlipStep } from "../src/crystal/minigames";

describe("Card Flip", () => {
  it("moves over the board, coming round at the edges and skipping the corner", () => {
    expect(cardFlipStep([1, 1], "right")).toEqual([2, 1]);
    expect(cardFlipStep([6, 2], "right")).toEqual([0, 2]);
    expect(cardFlipStep([1, 0], "left")).toEqual([6, 0]);
    expect(cardFlipStep([0, 1], "up")).toEqual([0, 4]);
    expect(cardFlipStep([3, 4], "down")).toEqual([3, 0]);
  });

  it("pays each bet at its odds", () => {
    expect(cardFlipPays([2, 3])).toBe(72);
    expect(cardFlipPays([2, 0])).toBe(18);
    expect(cardFlipPays([0, 3])).toBe(12);
  });
});
