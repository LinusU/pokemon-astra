import { describe, expect, it } from "vitest";
import { betLines, betStep } from "../src/ui/slots";

describe("slot machine", () => {
  it("steps the bet with the pad, coming round at the ends", () => {
    expect(betStep(1, "right", 3)).toBe(2);
    expect(betStep(3, "up", 3)).toBe(1);
    expect(betStep(1, "left", 3)).toBe(3);
    expect(betStep(2, "down", 2)).toBe(1);
    expect(betStep(1, "right", 1)).toBe(1);
    expect(betStep(0, "right", 0)).toBe(0);
  });

  it("plays one line per coin up to the diagonals", () => {
    expect(betLines(1)).toEqual([[0, 0, 0]]);
    expect(betLines(2)).toHaveLength(3);
    expect(betLines(3)).toContainEqual([-1, 0, 1]);
  });
});
