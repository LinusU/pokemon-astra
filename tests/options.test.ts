import { describe, expect, it } from "vitest";
import { cycleOption, optionStep } from "../src/ui/options";

describe("option rows", () => {
  it("steps a value both ways and comes round at the ends", () => {
    expect(cycleOption(1, 1, 3, 1)).toBe(2);
    expect(cycleOption(3, 1, 3, 1)).toBe(1);
    expect(cycleOption(1, -1, 3, 1)).toBe(3);
  });

  it("reads a left press once, then steps on again", () => {
    const button = { dataset: { step: "-1" } } as unknown as HTMLElement;
    expect(optionStep(button)).toBe(-1);
    expect(optionStep(button)).toBe(1);
  });
});
