import { describe, expect, it } from "vitest";
import { paginate } from "../src/crystal/ui";

describe("Crystal dialogue pages", () => {
  it("joins words split over two lines and keeps hyphenated ones", () => {
    expect(paginate("You and your POKé-\nMON should have")).toEqual(["You and your POKéMON should have"]);
    expect(paginate("here, but GOLDEN-\nROD has the best")).toEqual(["here, but GOLDENROD has the best"]);
    expect(paginate("We discovered some-\nthing")).toEqual(["We discovered something"]);
    expect(paginate("Is something wor- \nrying you?")).toEqual(["Is something worrying you?"]);
    expect(paginate("actually a BUG-\vtype move?")).toEqual(["actually a BUG-type move?"]);
    expect(paginate("Don't worry\n--take it!")).toEqual(["Don't worry--take it!"]);
  });
  it("runs a paragraph that stops mid-sentence on into the next", () => {
    expect(paginate("Oh, GOLD…! Our\nneighbor, PROF.ELM\fwas looking for\nyou. Also, your\fPOKéGEAR is back\nfrom the shop.\fHere you go!"))
      .toEqual(["Oh, GOLD…! Our neighbor, PROF.ELM was looking for you. Also, your POKéGEAR is back from the shop.", "Here you go!"]);
    expect(paginate("We discovered some-\fthing about the\nEGG!")).toEqual(["We discovered something about the EGG!"]);
    expect(paginate("Wait!\fI know!")).toEqual(["Wait!", "I know!"]);
  });
});

describe("Crystal names in title case", () => {
  it("keeps small words and possessives lowercase", async () => {
    const { titleCase } = await import("../src/crystal/runtime");
    expect(titleCase("LAKE OF RAGE")).toBe("Lake of Rage");
    expect(titleCase("DRAGON'S DEN")).toBe("Dragon's Den");
    expect(titleCase("MT.MORTAR")).toBe("Mt. Mortar");
    expect(titleCase("S.S. AQUA")).toBe("S.S. Aqua");
    expect(titleCase("POKéMON MANSION")).toBe("Pokémon Mansion");
    expect(titleCase("ROUTE 46")).toBe("Route 46");
  });
});
