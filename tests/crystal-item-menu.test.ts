import { describe, expect, it } from "vitest";
import { itemActions } from "../src/crystal/menu";
import { ITEM } from "../src/crystal/symbols";
import type { CrystalGame } from "../src/crystal/runtime";
import { cartridge, hasCrystal, SUITES } from "./crystal-fixtures";

describe.skipIf(!hasCrystal).each(SUITES)("%s Pack item submenu", name => {
  it("follows each item's attributes", async () => {
    const rom = await cartridge(name);
    const game = { rom } as unknown as CrystalGame;
    const menu = (item: string) => itemActions(game, ITEM[item]);
    expect(menu("POTION")).toEqual(["USE", "GIVE", "TOSS"]);
    expect(menu("LEFTOVERS")).toEqual(["GIVE", "TOSS"]);
    expect(menu("BICYCLE")).toEqual(["USE", "REGISTER"]);
    expect(menu("TM_DYNAMICPUNCH")).toEqual(["USE", "GIVE"]);
    expect(menu("HM_CUT")).toEqual(["USE"]);
  });
});
