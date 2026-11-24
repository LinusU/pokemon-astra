import { describe, expect, it } from "vitest";
import { cardFlipPays, cardFlipStep, slideFrom } from "../src/crystal/minigames";

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

describe("stone panel", () => {
  it("slides the piece on the far side of the gap", () => {
    expect(slideFrom(5, "up")).toBe(9);
    expect(slideFrom(5, "down")).toBe(1);
    expect(slideFrom(5, "left")).toBe(6);
    expect(slideFrom(5, "right")).toBe(4);
    expect(slideFrom(15, "up")).toBeUndefined();
    expect(slideFrom(3, "left")).toBeUndefined();
    expect(slideFrom(4, "right")).toBeUndefined();
  });
});
