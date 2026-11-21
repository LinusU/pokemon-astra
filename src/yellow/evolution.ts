import type { Pokemon } from "../engine";
import { playEvolution } from "../ui/evolution";
import { chooseEvolutionMove } from "../ui/learn-move";
import { mountParty } from "../ui/party";
import { SYM } from "./generated/symbols";
import type { YellowGame } from "./runtime";

/** Gen 1 species only: Yellow has no Crobat, Steelix or other Johto evolutions. */
function levelTarget(game: YellowGame, mon: Pokemon) {
  return game.engine.evolutionData(mon.species).evolutions
    .find(e => e.method === 1 && mon.level >= e.parameter && e.species <= 151)?.species;
}

export async function evolveAfterBattle(game: YellowGame, slots: number[]) {
  for (const slot of [...new Set(slots)]) {
    const mon = game.save.party[slot];
    if (!mon || !mon.hp) continue;
    const target = levelTarget(game, mon);
    if (target) await evolveTo(game, slot, target);
  }
}

export function evolveTo(game: YellowGame, slot: number, species: number) {
  const { engine } = game;
  const current = game.save.party[slot];
  const evolved = engine.evolvePokemon(current, species);
  const name = current.nickname || engine.species(current.species).name;
  game.ctx.cry(current.species);
  return new Promise<void>(resolve => {
    void playEvolution(game.layer, {
      from: game.ctx.sprite(current),
      to: game.ctx.sprite({ species, dvs: current.dvs }),
      name,
      evolvedName: engine.species(species).name,
      reveal: () => {
        game.save.party[slot] = evolved;
        game.register(species, true);
        game.ctx.cry(species);
      },
      ready: () => game.ctx.sound.overworld("evolved"),
      next: async () => {
        game.layer.replaceChildren();
        await learnLevelMoves(game, slot);
        game.persist();
        resolve();
      },
    });
  });
}

/** Moves the evolved form learns at its current level. */
async function learnLevelMoves(game: YellowGame, slot: number) {
  const mon = game.save.party[slot];
  const moves = game.engine.evolutionData(mon.species).learnset.filter(e => e.level === mon.level && !mon.moves.includes(e.move));
  for (const { move } of moves) await learn(game, slot, move);
}

export function learn(game: YellowGame, slot: number, move: number): Promise<boolean> {
  const mon = game.save.party[slot];
  const empty = mon.moves.indexOf(0);
  const name = mon.nickname || game.engine.species(mon.species).name;
  if (empty >= 0) {
    game.save.party[slot] = game.engine.teachMove(mon, move, empty);
    game.ctx.sound.overworld("item");
    return game.say(`${name} learned ${game.engine.move(move).name}!`).then(() => true);
  }
  return new Promise(resolve => {
    chooseEvolutionMove(game.layer, mon, move, game.engine, async replace => {
      game.layer.replaceChildren();
      if (replace === undefined) {
        await game.say(`${name} did not learn ${game.engine.move(move).name}.`);
        return resolve(false);
      }
      game.save.party[slot] = game.engine.teachMove(mon, move, replace);
      game.ctx.sound.overworld("item");
      await game.say(`${name} learned ${game.engine.move(move).name}!`);
      resolve(true);
    });
  });
}

/** Whether Yellow lets a species learn a TM (item $C9+) or HM ($C4+). */
export function canLearnMachine(game: YellowGame, dex: number, item: number) {
  if (dex < 1 || dex > 151) return false;
  const bit = item >= 0xc9 ? item - 0xc9 : 50 + item - 0xc4;
  const flags = SYM.BaseStats + (dex - 1) * 28 + 20;
  return !!(game.rom.u8(flags + (bit >> 3)) & (1 << (bit & 7)));
}

export function teachMove(game: YellowGame, item: number, move: number): Promise<string | undefined> {
  return new Promise(resolve => {
    const party = game.save.party;
    game.layer.replaceChildren();
    mountParty(game.layer, {
      title: `Teach ${game.engine.move(move).name}`, confirm: "Teach",
      rows: party.map(mon => ({
        name: mon.nickname || game.engine.species(mon.species).name, sprite: game.ctx.sprite(mon), level: mon.level,
        status: mon.status, hp: mon.hp, maxHp: mon.stats[0],
        note: mon.moves.includes(move) ? "Knows it" : canLearnMachine(game, mon.species, item) ? "Able" : "Not able",
        disabled: mon.moves.includes(move) || !canLearnMachine(game, mon.species, item),
      })),
      onSelect: async slot => {
        game.layer.replaceChildren();
        const learned = await learn(game, slot, move);
        if (learned && item >= 0xc9) {
          game.save.items[item]--;
          if (!game.save.items[item]) delete game.save.items[item];
        }
        resolve(undefined);
      },
      onBack: () => resolve(undefined),
    });
  });
}
