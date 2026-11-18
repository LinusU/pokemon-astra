import { describe, expect, it } from "vitest";
import { buildDex } from "../src/game/pokedex";

const save = { map: "route02", visited: ["route02"], flags: [], seen: [69, 43], caught: [69] };
const dex = buildDex(save, id => id === 60);

describe("Pokédex field records", () => {
  it("keeps national order and includes seen-but-uncaught species in Missing", () => {
    expect(dex.lists.All).toHaveLength(251);
    expect(dex.lists.Seen).toEqual([43, 69]);
    expect(dex.lists.Caught).toEqual([69]);
    expect(dex.lists.Missing).toContain(43);
    expect(dex.lists.Missing).not.toContain(69);
    expect(dex.lists.Local).toContain(69);
  });

  it("finds every species and puts local records first", () => {
    for (const id of dex.lists.All) expect(dex.habitats.get(id)?.length).toBeGreaterThan(0);
    expect(dex.habitats.get(69)?.[0]).toMatchObject({ map: { id: "route02" }, method: "Tall grass", level: "6–8" });
    expect(dex.habitats.get(144)).toContainEqual(expect.objectContaining({ method: "Guardian", level: "60", note: "Requires Waterfall" }));
    expect(dex.habitats.get(131)).toContainEqual(expect.objectContaining({ method: "Gift", level: "25" }));
  });

  it("includes fishing levels and the angler unlock at water locations", () => {
    const records = dex.habitats.get(129)!.filter(record => record.method === "Fishing");
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => record.level === "10" && record.note.includes("angler"))).toBe(true);
  });
});
