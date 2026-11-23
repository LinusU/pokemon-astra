import { describe, expect, it } from "vitest";
import { quantityStep } from "../src/ui/quantity";

describe("quantity picker", () => {
  it("steps by one and comes round at the ends", () => {
    expect(quantityStep(1, "up", 5)).toBe(2);
    expect(quantityStep(5, "up", 5)).toBe(1);
    expect(quantityStep(1, "down", 5)).toBe(5);
  });

  it("steps by ten and stops at the ends", () => {
    expect(quantityStep(1, "right", 99)).toBe(11);
    expect(quantityStep(95, "right", 99)).toBe(99);
    expect(quantityStep(7, "left", 99)).toBe(1);
  });
});
