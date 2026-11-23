import { describe, expect, it } from "vitest";
import { namingStep } from "../src/ui/naming";

// Rows of nine: A–I, J–R, S–Z and space, 0–8, then 9 . ' - with DEL and END.
const A = 0, I = 8, J = 9, NINE = 36, DASH = 39, DEL = 40, END = 41;

describe("naming screen cursor", () => {
  it("wraps along a row and up and down a column", () => {
    expect(namingStep(A, "left")).toBe(I);
    expect(namingStep(I, "right")).toBe(A);
    expect(namingStep(A, "down")).toBe(J);
    expect(namingStep(A, "up")).toBe(NINE);
    expect(namingStep(NINE, "down")).toBe(A);
  });

  it("reaches DEL and END, which span two columns each", () => {
    expect(namingStep(DASH, "right")).toBe(DEL);
    expect(namingStep(DEL, "right")).toBe(END);
    expect(namingStep(END, "right")).toBe(NINE);
    expect(namingStep(I, "up")).toBe(END);
    expect(namingStep(5, "up")).toBe(DEL);
  });

  it("keeps its column through the gap in the last row", () => {
    // Column 4 has no key in the last row, so the cursor passes over it.
    expect(namingStep(4, "up")).toBe(31);
    expect(namingStep(END, "up", 8)).toBe(35);
    expect(namingStep(END, "down", 8)).toBe(I);
  });
});
