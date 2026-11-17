// Run from the repository root after scripts/build-native.sh:
// node_modules/.bin/vite-node scripts/smoke-campaign.ts
// Optional: --rom /path/to/Crystal.gbc --starter 58 --pre-mira /tmp/pre-mira.json
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Engine, type BattleMon, type BattleOptions, type BattleSnapshot } from "../src/engine";
import { MEDICINE, useMedicine } from "../src/game/medicine";
import { freshSave, isValidSave, normalizeSavePosition, type Save } from "../src/game/save";
import { ABILITIES, WORLD, type WorldObject } from "../src/world";

const { values: options } = parseArgs({
  options: {
    rom: { type: "string", default: "pokecrystal11.gbc" },
    starter: { type: "string" },
    "pre-mira": { type: "string" },
  },
});
const starterChoices = [58, 60, 69];
const starters = options.starter ? [Number(options.starter)] : starterChoices;
assert(starters.every((starter) => starterChoices.includes(starter)), "Choose starter 58, 60, or 69");
assert(!options["pre-mira"] || options.starter, "Choose one starter when exporting a pre-Mira save");

const rom = readFileSync(options.rom!);
assert.equal(
  createHash("sha1").update(rom).digest("hex"),
  "f4cd194bdee0d04ca4eac29e09b8e4e9d818c133",
  "The campaign check requires the English Pokémon Crystal 1.1 ROM",
);
const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"));
const engine = new Engine(instance.exports as never, rom);
const pokeballId = 5;
const ultraballId = 2;
type Medicine = Parameters<typeof useMedicine>[0];
const leagueSupplies = { hyper_potion: 12, full_restore: 3, revive: 6, max_elixer: 4 } as const;

const rivalPartners: Record<number, number[]> = {
  58: [60, 61, 62, 62],
  60: [69, 70, 71, 71],
  69: [58, 58, 59, 59],
};
const targetSpecies: Record<number, number[]> = {
  1: [16, 19], 2: [179], 3: [194], 4: [27], 6: [78, 75],
  9: [55], 10: [64, 59], 13: [94, 105], 15: [131], 16: [135],
  17: [149], 19: [181], 20: [196],
};
const detours: Record<number, string[]> = {
  3: ["lantern_1", "gym1"], 5: ["undertow_1", "gym2"],
  7: ["copperworks_1", "gym3"], 9: ["hourglass_1", "gym4"],
  11: ["bamboo_1"], 13: ["ember_1", "gym5"], 15: ["frostvault_1", "gym6"],
  17: ["echo_1", "gym7"], 19: ["meridian_1", "meridian_3", "starfall_1", "gym8"],
  20: ["victory_1"],
};
const league = Object.values(WORLD)
  .flatMap((map) => map.objects)
  .filter((object) => object.trainer && /^league_[0-4]$/.test(object.id))
  .sort((a, b) => a.id.localeCompare(b.id));
assert.equal(league.length, 5);

const typeChart = new Map<string, number>();
for (let offset = 0x34bb1; rom[offset] !== 255; offset += 3) {
  if (rom[offset] === 254) offset++; // Foresight's delimiter
  typeChart.set(`${rom[offset]}:${rom[offset + 1]}`, rom[offset + 2] / 10);
}
const speciesTypes = new Map<number, number[]>();
const moves = new Map<number, ReturnType<Engine["move"]>>();

function types(species: number) {
  if (!speciesTypes.has(species))
    speciesTypes.set(species, [...new Set(engine.species(species).types)]);
  return speciesTypes.get(species)!;
}

function move(id: number) {
  if (!moves.has(id)) moves.set(id, engine.move(id));
  return moves.get(id)!;
}

type Combatant = BattleMon & { stats: number[] };
type LegalAction = "Fight" | "Run" | {
  Move?: { slot: number };
  Item?: { id: number; target: number | null };
  Switch?: { slot: number };
  ForcedSwitch?: { slot: number };
  OfferSwitch?: { keep: boolean; slot: number | null };
  LearnMove?: { slot: number | null };
};

// Used to choose actions only. The actual outcome, PP, health and all rewards
// come from the native battle engine.
function damageEstimate(user: Combatant, target: Combatant, moveId: number): number {
  const { power, type } = move(moveId);
  const special = type >= 20;
  const accuracy = rom[0x41afb + (moveId - 1) * 7 + 4] / 255;
  const effectiveness = types(target.species).reduce(
    (ratio, defense) => ratio * (typeChart.get(`${type}:${defense}`) ?? 1),
    1,
  );
  const attack = user.stats[special ? 3 : 0];
  const defense = target.stats[special ? 4 : 1];
  const standard = ((2 * user.level / 5 + 2) * power * attack) / Math.max(1, defense) / 50 + 2;
  const specialDamage: Record<number, number> = {
    49: 20, 69: user.level, 101: user.level, 162: target.hp / 2, 237: 40,
  };
  const damage = specialDamage[moveId] ?? (power ? standard : 0);
  return damage * effectiveness * accuracy * (types(user.species).includes(type) ? 1.5 : 1);
}

function threat(user: Combatant, target: Combatant) {
  return Math.max(
    0,
    ...user.moves.map((id, slot) => id && (user.pp[slot] & 63) ? damageEstimate(user, target, id) : 0),
  );
}

function chooseAction(
  snap: BattleSnapshot,
  turn: number,
  catching: boolean,
  early: boolean,
  ballId: number,
): number {
  const { player, enemy } = snap.state;
  const active = player.active as Combatant;
  const target = enemy.active as Combatant;
  const party = player.party as Combatant[];
  const legal = snap.legal as LegalAction[];
  const indexed = legal.map((action, index) => ({ action, index }));
  const score = (mon: Combatant) =>
    threat(mon, target) * 1.6 - threat(target, mon) * 0.8 + (mon.hp / mon.max_hp) * 5;

  if (snap.site === "LearnMove") {
    const request = (snap.events as { Message?: { AskForgetMove?: { mv: number } } }[])
      .find((event) => event.Message?.AskForgetMove)?.Message?.AskForgetMove;
    assert(request, "Move learning decision is missing a requested move");
    const mon = party[snap.learning_slot ?? player.active_slot];
    const rating = (id: number) => {
      const info = move(id);
      return info.power * (types(mon.species).includes(info.type) ? 1.35 : 1)
        + (id === 95 || id === 47 ? 44 : 0); // Hypnosis and Sing
    };
    return indexed
      .flatMap(({ action, index }) => typeof action === "object" && action.LearnMove ? [{
        index,
        rating: action.LearnMove.slot == null
          ? rating(request.mv) - 0.01
          : rating(mon.moves[action.LearnMove.slot]),
      }] : [])
      .sort((a, b) => a.rating - b.rating)[0].index;
  }

  if (snap.site === "ForcedSwitch" || snap.site === "OfferSwitch") {
    return indexed.flatMap(({ action, index }) => {
      if (typeof action !== "object") return [];
      const slot = action.ForcedSwitch?.slot ?? action.OfferSwitch?.slot;
      return [{ index, score: slot == null ? score(active) + 4 : score(party[slot]) }];
    }).sort((a, b) => b.score - a.score)[0].index;
  }

  const attacks = indexed.flatMap(({ action, index }) => {
    if (action === "Fight") return [{ index, damage: 1 }];
    if (typeof action !== "object" || !action.Move) return [];
    return [{ index, damage: damageEstimate(active, target, active.moves[action.Move.slot]) }];
  }).sort((a, b) => b.damage - a.damage);
  const item = (predicate: (item: { id: number; target: number | null }) => boolean) =>
    legal.findIndex((action) => typeof action === "object" && action.Item && predicate(action.Item));

  if (catching) {
    const ball = item((choice) => choice.id === ballId);
    if (ball >= 0) {
      const weakMove = attacks.filter(({ damage }) => damage > 0 && damage < target.hp * 0.82).at(-1);
      const weakened = target.hp / target.max_hp < (early ? 0.66 : 0.42);
      return weakened || !weakMove || turn > 5 ? ball : weakMove.index;
    }
  } else {
    const danger = threat(target, active);
    if (active.hp > danger * 1.4 && threat(active, target) < target.hp * 0.7
        && party.filter((mon) => mon.hp > 0).length <= 2) {
      const revive = indexed.flatMap(({ action, index }) => {
        if (typeof action !== "object" || action.Item?.id !== MEDICINE.revive.id || action.Item.target == null)
          return [];
        const mon = party[action.Item.target];
        return [{ index, priority: move(mon.moves.find(Boolean) ?? 33).power + mon.level }];
      }).sort((a, b) => b.priority - a.priority)[0];
      if (revive) return revive.index;
    }
    if (active.hp > danger * 1.15 && active.hp < active.max_hp * 0.65) {
      const restorative = item(({ id, target }) =>
        target === player.active_slot &&
        (id === MEDICINE.hyper_potion.id || (id === MEDICINE.full_restore.id && active.status !== 0)),
      );
      if (restorative >= 0) return restorative;
    }
    const replacement = indexed.flatMap(({ action, index }) => {
      if (typeof action !== "object" || !action.Switch) return [];
      const next = party[action.Switch.slot];
      return next.hp > threat(target, next) * 1.5 ? [{ index, score: score(next) }] : [];
    }).sort((a, b) => b.score - a.score)[0];
    if (replacement && replacement.score > score(active) + Math.max(8, active.level / 2))
      return replacement.index;
  }
  if (active.hp > threat(target, active) * 1.1
      && active.max_hp - active.hp >= 18 && active.hp < active.max_hp * 0.4) {
    const potion = item(({ id, target }) => id === MEDICINE.potion.id && target === player.active_slot);
    if (potion >= 0) return potion;
  }
  return attacks[0]?.index ?? 0;
}

function preMiraSave(save: Save, opponent: WorldObject): Save {
  const beforeChampion =
    /^(route(0[1-9]|1[0-9]|20)|gym[1-8]|\w+_center|league(?:_[a-z]+)?|(?:lantern|undertow|copperworks|hourglass|bamboo|ember|frostvault|echo|meridian|starfall|victory)_[1-3]|home|lab)$/;
  const visited = Object.values(WORLD)
    .filter((map) => map.kind === "town" || beforeChampion.test(map.id));
  const chamber = visited.find((map) => map.objects.includes(opponent));
  assert(chamber, "Mira's chamber must be in the pre-Champion campaign");
  const storyFlags = visited.flatMap((map) =>
    map.objects.flatMap((object) => (
      object.kind === "switch" && object.setsFlag &&
      !object.quest && !object.requires?.flags?.includes("champion")
    ) ? [object.setsFlag] : []),
  );
  const next = normalizeSavePosition({
    ...save,
    visited: visited.map((map) => map.id),
    flags: [...new Set([...save.flags, ...storyFlags])],
    map: chamber.id,
    x: opponent.x + 0.5,
    y: opponent.y + 1.5,
    facing: "up",
    center: "crown_center",
    settings: { battleSpeed: 3, music: false },
  });
  assert(isValidSave(next), "Pre-Mira save must pass normal import validation");
  return next;
}

function runCampaign(starter: number) {
  const save = freshSave();
  save.party = [engine.makeStarter(starter)];
  save.flags = ["partner", `starter_${starter}`];
  save.caught = [starter];
  save.seen = [starter];
  let seed = 105;
  let captures = 0;
  let trainerWins = 0;

  function record(species: number) {
    if (!save.seen.includes(species)) save.seen.push(species);
    if (!save.caught.includes(species)) save.caught.push(species);
  }

  function evolve(slot: number, species: number) {
    save.party[slot] = engine.evolvePokemon(save.party[slot], species);
    record(species);
  }

  function buy(key: string, quantity: number, price: number) {
    const cost = quantity * price;
    if (save.money < cost) return false;
    save.money -= cost;
    save.items[key] = (save.items[key] ?? 0) + quantity;
    return true;
  }

  function fight(opponent: BattleOptions["opponent"], catching = false) {
    const battle = engine.startBattle({
      party: save.party,
      opponent,
      training: true,
      seen: save.seen,
      caught: save.caught,
      seed: seed++,
      badges: (1 << save.badges) - 1,
      money: save.money,
      balls: [[pokeballId, save.items.poke_ball ?? 0], [ultraballId, save.items.ultra_ball ?? 0]],
      items: Object.entries(MEDICINE).map(([key, item]) => [item.id, save.items[key] ?? 0]),
    });
    for (let turn = 0; turn < 170; turn++) {
      const snapshot = battle.snapshot();
      if (snapshot.result) {
        const result = snapshot.result;
        save.party = result.party.slice(0, 6);
        save.storage.push(...result.party.slice(6));
        save.money = result.money;
        save.caught = result.world.caught;
        save.seen = result.world.seen;
        for (const [key, item] of Object.entries(MEDICINE))
          save.items[key] = result.bag.items.find(([id]) => id === item.id)?.[1] ?? 0;
        save.items.poke_ball = result.bag.balls.find(([id]) => id === pokeballId)?.[1] ?? 0;
        save.items.ultra_ball = result.bag.balls.find(([id]) => id === ultraballId)?.[1] ?? 0;
        if (result.caught !== null) {
          record(result.party[result.caught].species);
          captures++;
        }
        for (const slot of result.may_evolve) {
          const mon = save.party[slot];
          const evolution = engine.evolutionData(mon.species).evolutions.find(
            (entry) => entry.method === 1 && mon.level >= entry.parameter,
          );
          if (evolution) evolve(slot, evolution.species);
        }
        return result.outcome;
      }
      battle.act(chooseAction(snapshot, turn, catching, seed < 130, save.items.ultra_ball ? ultraballId : pokeballId));
    }
    throw Error("Battle exceeded 170 decisions");
  }

  function challenge(object: WorldObject, requireVictory: boolean) {
    const trainer = object.trainer!;
    const roster = trainer.team.map(({ species, level }, index) => {
      const rival = /^rival_([1-4])$/.exec(object.id);
      const partner = rival && index === trainer.team.length - 1
        ? rivalPartners[starter][Number(rival[1]) - 1] : species;
      return engine.makePokemon(partner, level);
    });
    const outcome = fight({ party: roster });
    if (outcome === "win") {
      save.money += trainer.reward ?? 0;
      save.flags.push(object.setsFlag ?? object.id);
      trainerWins++;
    }
    console.log(trainer.name, outcome, save.party.map(({ nickname, level }) => `${nickname} ${level}`).join(", "));
    if (requireVictory) assert.equal(outcome, "win", `Lost a required battle against ${trainer.name}`);
    if (object.kind === "leader") {
      save.abilities.push(ABILITIES[save.badges++]);
      if (save.badges === 1 && starter === 58) evolve(0, 59); // Dewdrop's Warm Hearth reward
    }
  }

  function giveMedicine(mon: Save["party"][number], key: Medicine) {
    if (!save.items[key]) return mon;
    const treated = useMedicine(key, mon, engine);
    if (!treated) return mon;
    save.items[key]--;
    return treated;
  }

  console.log(`\nStarter: ${engine.species(starter).name}`);
  for (let route = 1; route <= 20; route++) {
    const map = WORLD[`route${String(route).padStart(2, "0")}`];
    for (const species of targetSpecies[route] ?? []) {
      const encounter = map.encounters.find((entry) => entry.species === species);
      if (!encounter) continue;
      if (save.badges >= 5 && (save.items.ultra_ball ?? 0) < 5) buy("ultra_ball", 5, 1200);
      if (save.items.poke_ball < 4) buy("poke_ball", 10, 200);
      save.party = save.party.map((mon) => engine.healPokemon(mon));
      const replace = [10, 15, 17].includes(route) ? 1 : save.party.length - 1;
      const previous = save.party.length === 6 && save.party.splice(replace, 1)[0];
      const outcome = fight({ species, level: encounter.maxLevel }, true);
      if (previous) {
        if (outcome === "caught") save.storage.push(previous);
        else save.party.push(previous);
      }
      console.log(map.id, engine.species(species).name, outcome);
    }
    for (const location of [map.id, ...(detours[route] ?? [])]) {
      for (const object of WORLD[location].objects) {
        if (!object.trainer || object.kind === "legendary" || object.id.endsWith("_optional_1"))
          continue;
        // The road teams may backtrack to town between training fights.
        save.party = save.party.map((mon) => engine.healPokemon(mon));
        if (save.items.potion < 4) buy("potion", 4, MEDICINE.potion.price);
        const lead = save.party[0];
        if (save.badges >= 2 && ((lead.species === 61 && lead.level >= 32)
            || (lead.species === 70 && lead.level >= 42)) && save.money >= 2100) {
          save.money -= 2100;
          evolve(0, lead.species + 1);
        }
        challenge(object, object.kind === "leader" || object.id === "meridian_objective");
      }
    }
  }

  assert.equal(save.badges, 8, "Eight badges are required before entering the League");
  console.log(`League preparation: ${save.money} funds after ${trainerWins} trainer wins and ${captures} captures`);
  for (const [key, quantity] of Object.entries(leagueSupplies) as [keyof typeof leagueSupplies, number][])
    assert(buy(key, quantity, MEDICINE[key].price), `Cannot afford League supplies: ${key}`);

  // One full heal before Rowan. Use only purchased supplies between chambers.
  save.party = save.party.map((mon) => engine.healPokemon(mon));
  for (const opponent of league) {
    if (opponent.id !== "league_0") {
      save.party = save.party.map((mon) => {
        let ready = giveMedicine(mon, "revive");
        if (ready.status) ready = giveMedicine(ready, "full_restore");
        if (ready.hp < ready.stats[0] * 0.75) ready = giveMedicine(ready, "hyper_potion");
        if (ready.moves.some((id, slot) => id && move(id).power > 0 && (ready.pp[slot] & 63) <= 3))
          ready = giveMedicine(ready, "max_elixer");
        return ready;
      });
    }
    if (opponent.id === "league_4" && options["pre-mira"])
      writeFileSync(options["pre-mira"], JSON.stringify(preMiraSave(save, opponent)));
    challenge(opponent, true);
  }
  assert(save.flags.includes("champion"));
  console.log(`Won the League with ${engine.species(starter).name} as the original partner.`);
}

for (const starter of starters) runCampaign(starter);
