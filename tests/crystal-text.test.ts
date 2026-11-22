import { describe, expect, it } from "vitest";
import { paginate } from "../src/crystal/ui";

describe("Crystal dialogue pages", () => {
  it("joins words split over two lines and keeps hyphenated ones", () => {
    expect(paginate("You and your POKé-\nMON should have")).toEqual(["You and your POKéMON should have"]);
    expect(paginate("here, but GOLDEN-\nROD has the best")).toEqual(["here, but GOLDENROD has the best"]);
    expect(paginate("We discovered some-\nthing")).toEqual(["We discovered something"]);
    expect(paginate("actually a BUG-\vtype move?")).toEqual(["actually a BUG-type move?"]);
  });
});
