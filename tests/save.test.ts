import { depositPokemon, sortCollection, storePokemon, withdrawPokemon } from "../src/game/collection";
import { describe, expect, it } from "vitest";
import {
  freshSave,
  isValidSave,
  normalizeSavePosition,
  restoreQuestItems,
} from "../src/game/save";
import { WORLD } from "../src/world";
import type { Pokemon } from "../src/engine";

const pokemon: Pokemon = {
  species: 58,
  item: 0,
  moves: [44, 46, 52, 0],
  ot_id: 4660,
  exp: 216,
  stat_exp: [0, 0, 0, 0, 0],
  dvs: [136, 136],
  pp: [25, 20, 25, 0],
  happiness: 70,
  pokerus: 0,
  caught: [0, 0],
  level: 6,
  status: 0,
  hp: 23,
  stats: [23, 14, 12, 13, 12, 13],
  nickname: "GROWLITHE",
  ot_name: "ASTRA",
};
function populated() {
  return {
    ...freshSave(),
    party: [structuredClone(pokemon)],
    seen: [58],
    caught: [58],
    flags: ["partner"],
  };
}
describe("save files", () => {
  it("restores the Key Item for a legacy parcel handoff in progress", () => {
    const save = freshSave();
    save.flags.push("found_parcel");
    const restored = restoreQuestItems(save);
    expect(restored.items.courier_parcel).toBe(1);
    expect(restoreQuestItems(restored)).toBe(restored);
    save.flags.push("quest_parcel_complete");
    expect(restoreQuestItems(save).items.courier_parcel).toBeUndefined();
  });
  it("round-trips a party and item inventory without losing native fields", () => {
    const original = populated();
    original.items.fire_stone = 2;
    const copy = JSON.parse(JSON.stringify(original));
    expect(isValidSave(copy)).toBe(true);
    expect(copy).toEqual(original);
  });
  it("rejects broken native structures before they reach WebAssembly", () => {
    for (const patch of [
      { moves: [44] },
      { moves: [252, 0, 0, 0] },
      { dvs: [8, 8, 8, 8] },
      { stats: [23, 14] },
      { hp: 24 },
      { species: 252 },
      { level: 0 },
      { exp: -1 },
      { nickname: "x".repeat(33) },
    ]) {
      const save = populated();
      Object.assign(save.party[0], patch);
      expect(isValidSave(save), JSON.stringify(patch)).toBe(false);
    }
  });
  it("rejects duplicate/out-of-range dex entries and invalid world state", () => {
    for (const patch of [
      { caught: [58, 58] },
      { caught: [0] },
      { caught: [251] },
      { abilities: ["teleport"] },
      { map: "missing" },
      { x: NaN },
      { badges: 9 },
      { settings: { battleSpeed: 0 } },
      { money: -1 },
    ]) {
      expect(
        isValidSave({ ...populated(), ...patch }),
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
  it("recovers a saved position obstructed by a later map revision", () => {
    const save = populated();
    save.x = 0.5;
    save.y = 0.5;
    expect(isValidSave(save)).toBe(true);
    const recovered = normalizeSavePosition(save),
      tile =
        WORLD[recovered.map].tiles[Math.floor(recovered.y)][
          Math.floor(recovered.x)
        ];
    expect("#rwBCPTS~".includes(tile)).toBe(false);
    expect(recovered.party).toEqual(save.party);
    expect(normalizeSavePosition(recovered)).toBe(recovered);
  });
  it("moves an old save clear of newly solid NPCs without altering progress", () => {
    const save = populated(),
      npc = WORLD.dewdrop.objects.find((o) => o.kind === "person")!;
    save.x = npc.x + 0.5;
    save.y = npc.y + 0.5;
    const recovered = normalizeSavePosition(save);
    expect(
      Math.hypot(recovered.x - save.x, recovered.y - save.y),
    ).toBeGreaterThan(0.6);
    expect(recovered.party).toEqual(save.party);
    expect(recovered.flags).toEqual(save.flags);
  });
});

it("recovers a v1 adventure beyond the edge of a resized route", () => {
  const original = { ...populated(), map: "route02", x: 20.5, y: 38.5 };
  expect(isValidSave(original)).toBe(true);
  const repaired = normalizeSavePosition(original);
  expect(repaired.y).toBeLessThan(WORLD.route02.height);
  expect(repaired.party).toEqual(original.party);
  expect(repaired.flags).toEqual(original.flags);
});

it("recovers an old save on a newly planted Cut tree without awarding the badge or clearing the trail", () => {
  const exit = WORLD.bramble.exits.find((e) => e.to === "route04")!;
  const old = {
    ...populated(),
    map: "bramble",
    x: exit.x + 0.5,
    y: exit.y + 0.5,
  };
  const recovered = normalizeSavePosition(old);
  expect(recovered.x).toBeLessThan(exit.x);
  expect(recovered.flags).toEqual(old.flags);
  expect(recovered.badges).toBe(0);
  expect(normalizeSavePosition(recovered)).toBe(recovered);
});

describe("Center PC", () => {
  it("orders old saves, new captures and deposits by species, retaining each individual", () => {
    const save = populated();
    const young = { ...pokemon, level: 4, nickname: "Juniper" };
    const twin = { ...young, nickname: "Ash" };
    save.storage = [{ ...pokemon, species: 251 }, twin, young, pokemon];
    sortCollection(save.storage);
    storePokemon(save.storage, { ...pokemon, species: 1 });
    expect(save.storage.map(mon => mon.species)).toEqual([1, 58, 58, 58, 251]);
    expect(save.storage.slice(1, 4)).toEqual([twin, young, pokemon]);
    save.party.push({ ...pokemon, species: 25 });
    expect(depositPokemon(save, 1)).toBe(true);
    expect(save.storage[1].species).toBe(25);
    expect(withdrawPokemon(save, young)).toBe(true);
    expect(save.party[1]).toBe(young);
    expect(save.storage).toContain(twin);
    expect(withdrawPokemon(save, young)).toBe(false);
    expect(isValidSave(JSON.parse(JSON.stringify(save)))).toBe(true);
  });
  it("swaps into the chosen full-party slot and keeps an able partner on failed transfers", () => {
    const save = populated(), injured = { ...pokemon, species: 60, hp: 0, status: 8, item: 57 };
    for (let i = 1; i < 6; i++) save.party.push({ ...pokemon, hp: 0 });
    storePokemon(save.storage, injured);
    const lead = save.party[0];
    expect(withdrawPokemon(save, injured)).toBe(false);
    expect(withdrawPokemon(save, injured, 0)).toBe(false);
    expect(depositPokemon(save, 0)).toBe(false);
    expect(save.party[0]).toBe(lead);
    expect(save.storage).toEqual([injured]);
    const outgoing = save.party[3];
    expect(withdrawPokemon(save, injured, 3)).toBe(true);
    expect(save.party[3]).toBe(injured);
    expect(save.storage).toEqual([outgoing]);
  });
});
