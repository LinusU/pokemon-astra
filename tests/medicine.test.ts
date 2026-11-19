import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { MEDICINE, useMedicine } from "../src/game/medicine";

describe.skipIf(!existsSync("pokecrystal11.gbc") || !existsSync("public/astra_native.wasm"))("field and battle supplies", () => {
  let engine: Engine;
  beforeAll(async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
  });
  it("offers the matching status cure and clears a reserve's condition in the field and native battle", () => {
    const lead = engine.makePokemon(58, 20);
    for (const key of ["antidote", "awakening", "parlyz_heal", "ice_heal", "burn_heal", "full_heal"] as const) {
      const { id, status } = MEDICINE[key];
      const mon = { ...engine.makePokemon(60, 18), status: key === "awakening" ? 3 : key === "full_heal" ? 8 : status };
      const treated = useMedicine(key, mon, engine);
      expect(treated).toEqual({ ...mon, status: 0 });
      expect(useMedicine(key, { ...mon, hp: 0 }, engine)).toBeUndefined();
      expect(useMedicine(key, lead, engine)).toBeUndefined();
      const battle = engine.startBattle({ party: [lead, mon], opponent: { species: 129, level: 5 }, items: [[id, 2]], seed: 1 });
      const actions = battle.snapshot().legal as { Item?: { id: number; target: number } }[];
      expect(actions.filter(a => a.Item?.id === id).map(a => a.Item?.target)).toEqual([1]);
      const next = battle.act(actions.findIndex(a => a.Item?.id === id));
      expect(next.state.player.party?.[1].status).toBe(0);
      expect(next.bag.items).toContainEqual([id,1]);
    }
  });
  it("restores the selected move's PP, preserving PP Ups, other moves and fainted HP", () => {
    const reserve = engine.makePokemon(60, 30);
    const filled = engine.healPokemon(reserve);
    const mon = { ...reserve, hp: 0, pp: [...filled.pp] };
    mon.pp[1] = 0x80 | 1;
    mon.pp[2] = 0;
    const treated = useMedicine("ether", mon, engine, 1)!;
    expect(treated.pp).toEqual([mon.pp[0], 0x80 | 11, 0, mon.pp[3]]);
    expect(treated.hp).toBe(0);
    expect(useMedicine("ether", mon, engine, 0)).toBeUndefined();
    const battle = engine.startBattle({ party: [engine.makePokemon(58, 20), mon], opponent: { species: 129, level: 5 }, items: [[63, 2]], seed: 1 });
    const actions = battle.snapshot().legal as { Item?: { id: number; target: number; move_slot?: number } }[];
    const choices = actions.filter(a => a.Item?.id === 63 && a.Item.target === 1);
    expect(choices.map(a => a.Item?.move_slot)).toEqual([1, 2]);
    const next = battle.act(actions.indexOf(choices[0]));
    expect(next.state.player.party?.[1].pp).toEqual(treated.pp);
    expect(next.bag.items).toContainEqual([63,1]);
  });
});
