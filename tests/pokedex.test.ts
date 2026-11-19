import { describe, expect, it } from "vitest";
import { buildDex, locateHabitat } from "../src/game/pokedex";
import { freshSave, meetsRequirement } from "../src/game/save";

const save = { badges: 0, abilities: [], map: "route02", visited: ["route02"], flags: [], seen: [69, 43], caught: [69] };
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
    expect(dex.habitats.get(131)).toContainEqual(expect.objectContaining({ method: "Field request", level: "25" }));
  });

  it("includes fishing levels and the angler unlock at water locations", () => {
    const records = dex.habitats.get(129)!.filter(record => record.method === "Fishing");
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => record.level === "10" && record.note.includes("angler"))).toBe(true);
  });

  it("records one-time choices without directing a player to an unclaimed second gift", () => {
    const records = (flags: string[], id: number) =>
      buildDex({ ...save, flags, caught: [60] }, () => false).habitats.get(id)!;
    for (const id of [58, 60, 69])
      expect(records([], id)).toContainEqual(expect.objectContaining({ method: "Starter", level: "6" }));
    expect(records(["partner"], 60)).toContainEqual(expect.objectContaining({ method: "Starter", note: "Your first partner" }));
    expect(records(["partner", "starter_58"], 60).some(r => r.method === "Starter")).toBe(false);
    for (const id of [138, 140])
      expect(records([], id)).toContainEqual(expect.objectContaining({ method: "Fossil revival", level: "20" }));
    const flags = ["quest_fossil_complete", "fossil_140"];
    expect(records(flags, 140)).toContainEqual(expect.objectContaining({ note: "Fossil revived" }));
    expect(records(flags, 138).some(r => r.method === "Fossil revival")).toBe(false);
    expect(records(["quest_fossil_complete"], 138).some(r => r.method === "Fossil revival")).toBe(false);
  });

  it("locates habitats through open roads and gives local field directions at the destination", () => {
    const journey = freshSave();
    const has = (requirement: Parameters<typeof meetsRequirement>[1]) => meetsRequirement(journey, requirement);
    const ordinary = dex.habitats.get(25)!.find(r => r.method === "Tall grass")!;
    const pilot = dex.habitats.get(131)!.find(r => r.method === "Field request")!;
    expect(pilot.note).toMatch(/fog signal.*Surf/);
    expect(locateHabitat(pilot, journey, has).hint).toMatch(/No walking route/);
    journey.flags.push("partner");
    expect(locateHabitat(ordinary, journey, has).hint).toContain(ordinary.map.name);
    journey.map = ordinary.map.id;
    expect(locateHabitat(ordinary, journey, has).hint).toMatch(/tall grass/);
    journey.map = pilot.map.id;
    journey.x = pilot.contact!.x + 0.5;
    journey.y = pilot.contact!.y + 2.5;
    const located = locateHabitat(pilot, journey, has);
    expect(located.hint).toBe("Pilot Lapras · north");
    expect(located.position.area).toMatch(/^route/);
  });
});
