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
import { awardBadge, badgeMask, fieldTeam } from "../src/game/badges";
import { WORLD, type WorldObject } from "../src/world";

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
const ballStock = [[5, "poke_ball", 200, 0], [4, "great_ball", 600, 2], [2, "ultra_ball", 1200, 5]] as const;
type Medicine = Parameters<typeof useMedicine>[0];
const leagueSupplies = { hyper_potion: 10, super_potion: 6, full_restore: 1, revive: 5, max_elixer: 2 } as const;

const rivalPartners: Record<number, number[]> = {
  58: [60, 61, 62, 62],
  60: [69, 70, 71, 71],
  69: [58, 58, 59, 59],
};
const targetSpecies: Record<number, number[]> = {
  1: [16, 19], 2: [179], 3: [194], 4: [27], 5: [170], 6: [75, 51],
  8: [105, 229], 9: [55], 10: [64], 11: [71], 13: [105], 14: [215], 15: [131], 16: [135],
  17: [149], 19: [181], 20: [248],
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
function damageEstimate(user: Combatant, target: Combatant, moveId: number, ignoreAccuracy = false): number {
  const { power, type } = move(moveId);
  const estimatedPower = moveId === 222 ? 71 : power;
  const special = type >= 20;
  const accuracy = rom[0x41afb + (moveId - 1) * 7 + 4] / 255;
  const effectiveness = types(target.species).reduce(
    (ratio, defense) => ratio * (typeChart.get(`${type}:${defense}`) ?? 1),
    1,
  );
  const attack = user.stats[special ? 3 : 0];
  const defense = target.stats[special ? 4 : 1];
  const standard = ((2 * user.level / 5 + 2) * estimatedPower * attack) / Math.max(1, defense) / 50 + 2;
  const specialDamage: Record<number, number> = {
    49: 20, 69: user.level, 101: user.level, 162: target.hp / 2, 237: 40,
  };
  const damage = specialDamage[moveId] ?? (power ? standard : 0);
  return damage * effectiveness * (ignoreAccuracy ? 1 : accuracy) * (types(user.species).includes(type) ? 1.5 : 1);
}

function threat(user: Combatant, target: Combatant, ignoreAccuracy = false) {
  return Math.max(
    0,
    ...user.moves.map((id, slot) => id && (user.pp[slot] & 63) ? damageEstimate(user, target, id, ignoreAccuracy) : 0),
  );
}

function chooseAction(
  snap: BattleSnapshot,
  turn: number,
  catching: boolean,
  early: boolean,
  ballId: number,
  league: boolean,
): number {
  const { player, enemy } = snap.state;
  const active = player.active as Combatant;
  const target = enemy.active as Combatant;
  const party = player.party as Combatant[];
  const legal = snap.legal as LegalAction[];
  const indexed = legal.map((action, index) => ({ action, index }));
  const score = (mon: Combatant) => {
    const damage = threat(mon, target);
    if (!league) return damage * 1.6 - threat(target, mon) * 0.8 + (mon.hp / mon.max_hp) * 5;
    const danger = threat(target, mon, true);
    const movesFirst = !(mon.status & 64) && mon.stats[2] > target.stats[2];
    const requiredTurns = target.hp / Math.max(1, damage) - Number(movesFirst);
    const margin = mon.hp / Math.max(1, danger) - requiredTurns;
    return damage / target.hp * 80 + Math.max(-4, Math.min(4, margin)) * 27 + mon.hp / mon.max_hp * 8;
  };

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
    const ball = [ballId, ...ballStock.map(([id]) => id).reverse()]
      .map((id) => item((choice) => choice.id === id)).find((index) => index >= 0) ?? -1;
    if (ball >= 0) {
      const weakMove = attacks.filter(({ index, damage }) => {
        const action = legal[index];
        const moveId = typeof action === "object" && action.Move ? active.moves[action.Move.slot] : 0;
        return damage > 0 && damage < target.hp * (moveId === 222 ? 0.55 : 0.80);
      }).at(-1);
      const weakened = target.hp / target.max_hp < (early ? 0.66 : 0.42);
      return weakened || !weakMove || turn > 3 ? ball : weakMove.index;
    }
  } else {
    const danger = threat(target, active, league);
    const first = !(active.status & 64) && active.stats[2] > target.stats[2];
    if (league && attacks[0]?.damage >= target.hp * 1.1 && (first || active.hp > danger))
      return attacks[0].index;
    if (league && party.filter((mon) => mon.hp > 0).length <= 3) {
      const revival = indexed.flatMap(({ action, index }) => {
        if (typeof action !== "object" || action.Item?.id !== MEDICINE.revive.id || action.Item.target == null)
          return [];
        const mon = party[action.Item.target];
        return [{ index, margin: score({ ...mon, hp: Math.floor(mon.max_hp / 2) }) - score(active) }];
      }).sort((a, b) => b.margin - a.margin)[0];
      if (revival && revival.margin > 30 && target.hp > (attacks[0]?.damage ?? 0) * 2)
        return revival.index;
    }
    if (!target.status && target.hp > (attacks[0]?.damage ?? 0) * 2
        && active.hp < danger * 3.5) {
      const sleep = indexed.find(({ action }) => typeof action === "object" &&
        action.Move && [47, 79, 95, 142, 147].includes(active.moves[action.Move.slot]));
      if (sleep) return sleep.index;
    }
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
    const hpMissing = active.max_hp - active.hp;
    if (league && active.status && hpMissing >= 40) {
      const fullRestore = item(({ id, target }) => id === MEDICINE.full_restore.id && target === player.active_slot);
      if (fullRestore >= 0) return fullRestore;
    }
    const healingMoves = [
      [MEDICINE.potion.id, 20], [MEDICINE.super_potion.id, 50],
      [MEDICINE.hyper_potion.id, 200], [MEDICINE.full_restore.id, 999],
    ];
    const recovery = healingMoves.find(([id, hp]) =>
      hpMissing >= Math.min(25, hp / 2) &&
      Math.min(active.max_hp, active.hp + hp) > danger * 1.1 &&
      item((choice) => choice.id === id && choice.target === player.active_slot) >= 0,
    );
    if (recovery && active.hp <= danger * 1.5 && (target.hp > attacks[0]?.damage || active.stats[2] <= target.stats[2]))
      return item(({ id, target }) => id === recovery[0] && target === player.active_slot);
    const replacement = indexed.flatMap(({ action, index }) => {
      if (typeof action !== "object" || !action.Switch) return [];
      const next = party[action.Switch.slot];
      return next.hp > threat(target, next) * 1.5 ? [{ index, score: score(next) }] : [];
    }).sort((a, b) => b.score - a.score)[0];
    if (replacement && replacement.score > score(active) + Math.max(8, active.level / 2))
      return replacement.index;
  }
  if (active.max_hp - active.hp >= 10
      && active.hp <= threat(target, active) * 1.6
      && Math.min(active.max_hp, active.hp + 20) > threat(target, active) * 1.3) {
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
  save.items.poke_ball = 10;
  save.items.potion = 5;
  save.flags = ["partner", `starter_${starter}`];
  save.caught = [starter];
  save.seen = [starter];
  // Show Growlithe to the Dewdrop elder for the Fire Stone before leaving.
  if (starter === 58) evolve(0, 59);
  let bestBall = pokeballId;
  const partnerFamily = new Set(starter === 58 ? [58, 59] : starter === 60 ? [60, 61, 62, 186] : [69, 70, 71]);
  let seed = 105;
  let captures = 0;
  let trainerWins = 0;
  let practiceWins = 0;
  const routePractice: WorldObject[] = [];

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
      seen: save.seen,
      caught: save.caught,
      seed: seed++,
      badges: badgeMask(save),
      money: save.money,
      balls: ballStock.map(([id, key]) => [id, save.items[key] ?? 0]),
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
        for (const [ballId, key] of ballStock)
          save.items[key] = result.bag.balls.find(([id]) => id === ballId)?.[1] ?? 0;
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
      battle.act(chooseAction(snapshot, turn, catching, save.badges < 2, bestBall, save.badges === 8));
    }
    throw Error("Battle exceeded 170 decisions");
  }

  function makeRoster(object: WorldObject) {
    return fieldTeam(object, save.badges).map(({ species, level }, index) => {
      const rival = /^rival_([1-4])$/.exec(object.id);
      const partner = rival && index === object.trainer!.team.length - 1
        ? rivalPartners[starter][Number(rival[1]) - 1] : species;
      return engine.makePokemon(partner, level);
    });
  }

  function makeLead(slot: number) {
    if (slot > 0) [save.party[0], save.party[slot]] = [save.party[slot], save.party[0]];
  }

  function practice(object: WorldObject, lead?: number) {
    makeLead(lead ?? 0);
    save.party = save.party.map((mon) => engine.healPokemon(mon));
    const outcome = fight({ party: makeRoster(object) });
    if (outcome === "win") {
      practiceWins++;
      save.money += Math.floor((object.trainer?.reward ?? 0) / 2);
    }
    console.log(`Practice against ${object.trainer!.name}: ${outcome}, party levels ${save.party.map((mon) => mon.level).join(", ")}`);
  }

  function challenge(object: WorldObject, requireVictory: boolean) {
    const trainer = object.trainer!;
    const roster = makeRoster(object);
    if (save.badges > 0) {
      const battleMon = (mon: Save["party"][number]): Combatant => ({
        ...mon,
        max_hp: mon.stats[0],
        stats: mon.stats.slice(1),
      });
      const ranked = save.party.map((mon, slot) => {
        const actor = battleMon(mon);
        const ratings = roster.map((enemy) => {
          const target = battleMon(enemy);
          return threat(actor, target) / target.hp - threat(target, actor) / actor.hp;
        });
        return { slot, rating: ratings[0] * 1.4 + Math.max(...ratings) * 0.4 };
      }).sort((a, b) => b.rating - a.rating);
      const preferred = ranked[0].slot;
      const viablePractice = save.badges < 8 && object.kind !== "leader"
        ? ranked.filter(({ rating }) => rating > 0.05 && rating >= ranked[0].rating - 0.16)
          .sort((a, b) => save.party[a.slot].level - save.party[b.slot].level)[0]?.slot
        : undefined;
      const training = save.badges === 1 && object.kind !== "leader"
        ? save.party.findIndex((mon) => types(mon.species).includes(22) && mon.level < 16)
        : save.badges === 2 && object.kind !== "leader"
          ? save.party.findIndex((mon) => [38, 51].includes(mon.species) && mon.level < 20)
          : save.badges === 4 && object.kind !== "leader"
            ? save.party.findIndex((mon) => types(mon.species).includes(21) && mon.level >= 16 && mon.level < 32)
            : -1;
      const lead = training >= 0 ? training : viablePractice ?? preferred;
      makeLead(lead);
    }
    let outcome = fight({ party: roster });
    if (requireVictory && save.badges < 8 && outcome !== "win") {
      const lead = save.party[0];
      for (const previous of routePractice.slice(-2)) practice(previous);
      save.party = save.party.map((mon) => engine.healPokemon(mon));
      makeLead(save.party.findIndex((mon) => mon.species === lead.species));
      outcome = fight({ party: roster });
    }
    if (outcome === "win") {
      save.money += trainer.reward ?? 0;
      save.flags.push(object.setsFlag ?? object.id);
      trainerWins++;
    }
    console.log(trainer.name, outcome, save.party.map(({ nickname, level }) => `${nickname} ${level}`).join(", "));
    if (requireVictory) assert.equal(outcome, "win", `Lost a required battle against ${trainer.name}`);
    if (object.kind === "leader") {
      awardBadge(save, object.reward!.badge!);
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
    const additions = route === 2 && starter !== 69 ? [69] : route === 3 && starter !== 58 ? [37] : [];
    for (const species of [...(targetSpecies[route] ?? []), ...additions]) {
      if (save.party.some((mon) => mon.species === species)) continue;
      if (species === 105 && save.party.some((mon) => mon.species === 51)) continue;
      const encounter = map.encounters.find((entry) => entry.species === species);
      if (!encounter) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        const [ballId, key, price] = ballStock.filter(([, , , badges]) => save.badges >= badges).at(-1)!;
        if ((save.items[key] ?? 0) < 4) buy(key, Math.min(5, Math.floor(save.money / price)), price);
        bestBall = save.items[key] ? ballId : pokeballId;
        save.party = save.party.map((mon) => engine.healPokemon(mon));
        const replace = save.party
          .map((mon, slot) => ({ mon, slot }))
          .filter(({ mon }) => !partnerFamily.has(mon.species))
          .filter(({ mon }) => ![51, 55, 105, 131, 149, 181, 229].includes(mon.species) || mon.species === species)
          .sort((a, b) => a.mon.level - b.mon.level)[0]?.slot ?? save.party.length - 1;
        const previous = save.party.length === 6 && save.party.splice(replace, 1)[0];
        const outcome = fight({ species, level: encounter.maxLevel }, true);
        if (previous) {
          if (outcome === "caught") save.storage.push(previous);
          else save.party.push(previous);
        }
        console.log(map.id, engine.species(species).name, outcome);
        if (outcome === "caught") {
          if (species === 37) evolve(save.party.length - 1, 38); // Route 02 Fire Stone
          break;
        }
      }
    }
    if (route === 2 && starter !== 58) {
      const mareep = save.party.findIndex((mon) => mon.species === 179);
      if (mareep > 0) [save.party[0], save.party[mareep]] = [save.party[mareep], save.party[0]];
    }
    for (const location of [map.id, ...(detours[route] ?? [])]) {
      for (const object of WORLD[location].objects) {
        if (!object.trainer || object.kind === "legendary")
          continue;
        // The road teams may backtrack to town between training fights.
        save.party = save.party.map((mon) => engine.healPokemon(mon));
        if (save.items.potion < 4) buy("potion", 4, MEDICINE.potion.price);
        if (object.kind === "leader" || object.id === "meridian_objective") {
          for (const key of ["super_potion", "hyper_potion", "revive"] as const)
            if (save.badges >= MEDICINE[key].badges && (save.items[key] ?? 0) < 3)
              buy(key, 3, MEDICINE[key].price);
        }
        const lead = save.party[0];
        if (save.badges >= 2 && ((lead.species === 61 && lead.level >= 32)
            || (lead.species === 70 && lead.level >= 42)) && save.money >= 2100) {
          save.money -= 2100;
          evolve(0, lead.species + 1);
        }
        challenge(object, object.kind === "leader" || object.id === "meridian_objective");
        if (WORLD[location].kind === "route" && !/^rival_/.test(object.id)
          && save.flags.includes(object.setsFlag ?? object.id))
          routePractice.push(object);
      }
    }
  }

  assert.equal(save.badges, 8, "Eight badges are required before entering the League");
  // Use up to eight route rematches to build the endgame team, with each new
  // recruit taking the lead on a route fight they can handle.
  const trainees = [...save.party].sort((a, b) => b.level - a.level).slice(0, 5);
  const lastTrainers = routePractice.slice(-4);
  for (const [index, trainer] of [...lastTrainers, ...lastTrainers].entries()) {
    const species = trainees[index % lastTrainers.length + 1]?.species;
    practice(trainer, save.party.findIndex((mon) => mon.species === species));
  }
  console.log(`League preparation: ${save.money} funds after ${trainerWins} trainer wins, ${practiceWins} rematches and ${captures} captures`);
  for (const [key, quantity] of Object.entries(leagueSupplies) as [keyof typeof leagueSupplies, number][])
    assert(buy(key, Math.max(0, quantity - (save.items[key] ?? 0)), MEDICINE[key].price), `Cannot afford League supplies: ${key}`);

  // One full heal before Rowan. Use only purchased supplies between chambers.
  save.party = save.party.map((mon) => engine.healPokemon(mon));
  for (const opponent of league) {
    if (opponent.id !== "league_0") {
      save.party = save.party.map((mon) => {
        let ready = giveMedicine(mon, "revive");
        if (ready.status) ready = giveMedicine(ready, "full_restore");
        const missing = ready.stats[0] - ready.hp;
        if (missing >= 55) ready = giveMedicine(ready, "hyper_potion");
        else if (missing >= 28) ready = giveMedicine(ready, "super_potion");
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
