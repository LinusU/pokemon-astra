/**
 * Safari Zone battles. The Crystal battle engine has no Safari mode, so this
 * follows Gen 1's rules directly: Safari Balls, Bait and Rocks change the catch
 * and flee chances, and the player's Pokémon never fight.
 */
import { escapeHtml } from "../ui/shell";
import { MAP, SYM } from "./generated/symbols";
import type { BattleOutcome } from "./script";
import type { YellowGame } from "./runtime";

export const SAFARI_MAPS = new Set(["SAFARI_ZONE_EAST", "SAFARI_ZONE_NORTH", "SAFARI_ZONE_WEST", "SAFARI_ZONE_CENTER",
  "SAFARI_ZONE_CENTER_REST_HOUSE", "SAFARI_ZONE_WEST_REST_HOUSE", "SAFARI_ZONE_EAST_REST_HOUSE", "SAFARI_ZONE_NORTH_REST_HOUSE"].map(n => MAP[n]));

/** Base stats from the cartridge: [catch rate, speed]. */
function stats(game: YellowGame, dex: number) {
  const o = SYM.BaseStats + (dex - 1) * 28;
  return { catchRate: game.rom.u8(o + 8), speed: game.rom.u8(o + 4) };
}

export function safariBattle(game: YellowGame, species: number, level: number): Promise<BattleOutcome> {
  const dex = game.rom.dex(species), name = game.rom.monName(species);
  const base = stats(game, dex);
  let catchRate = base.catchRate, escape = base.speed * 2, bait = 0, rock = 0;
  game.register(dex, false);
  return new Promise(resolve => {
    const root = game.layer;
    root.innerHTML = `<section class="battle-scene yellow-safari" data-arena="field"><div class="battle-field"><div class="battle-hud battle-enemy-hud"><strong>${escapeHtml(name)}</strong> <span>:L${level}</span></div><div class="battle-mon battle-enemy"><img alt="" src="${game.ctx.sprite(dex)}"></div></div><div class="battle-box"><div class="battle-copy" aria-live="polite"></div><div class="battle-controls"></div></div></section>`;
    game.ctx.cry(dex);
    const copy = root.querySelector<HTMLElement>(".battle-copy")!, controls = root.querySelector<HTMLElement>(".battle-controls")!;
    const say = (text: string) => new Promise<void>(next => {
      copy.textContent = text;
      controls.innerHTML = `<button data-next>▼</button>`;
      const button = controls.querySelector<HTMLButtonElement>("[data-next]")!;
      button.onclick = () => next();
      button.focus({ preventScroll: true });
    });
    const finish = (outcome: BattleOutcome) => {
      root.replaceChildren();
      resolve(outcome);
    };
    const flees = () => {
      // Gen 1: the wild Pokémon flees when a random byte is below twice its speed, halved while eating and doubled when angry.
      let x = escape;
      if (bait) x = Math.floor(x / 4);
      else if (rock) x = Math.min(255, x * 2);
      return Math.floor(Math.random() * 256) < x;
    };
    const afterTurn = async () => {
      if (bait) bait--;
      if (rock) rock--;
      if (bait) await say(`Wild ${name} is eating!`);
      else if (rock) await say(`Wild ${name} is angry!`);
      if (flees()) {
        await say(`Wild ${name} ran!`);
        return finish("run");
      }
      menu();
    };
    const menu = () => {
      const balls = game.save.safari?.balls ?? 0;
      copy.textContent = `What will ${game.save.name} do?`;
      controls.innerHTML = `<div class="battle-command-grid"><button data-cmd="ball">BALL×${balls}</button><button data-cmd="bait">BAIT</button><button data-cmd="rock">THROW ROCK</button><button data-cmd="run">RUN</button></div>`;
      controls.querySelector<HTMLButtonElement>("button")!.focus({ preventScroll: true });
      for (const b of controls.querySelectorAll<HTMLButtonElement>("[data-cmd]")) b.onclick = () => void act(b.dataset.cmd!);
    };
    const act = async (cmd: string) => {
      const safari = game.save.safari!;
      if (cmd === "run") {
        await say("Got away safely!");
        return finish("run");
      }
      if (cmd === "bait") {
        bait = Math.min(255, bait + 1 + Math.floor(Math.random() * 5));
        rock = 0;
        catchRate = Math.max(1, Math.floor(catchRate / 2));
        await say(`${game.save.name} threw some BAIT.`);
        return afterTurn();
      }
      if (cmd === "rock") {
        rock = Math.min(255, rock + 1 + Math.floor(Math.random() * 5));
        bait = 0;
        catchRate = Math.min(255, catchRate * 2);
        await say(`${game.save.name} threw a ROCK.`);
        return afterTurn();
      }
      safari.balls--;
      await say(`${game.save.name} used SAFARI BALL!`);
      // Safari Balls draw from 0-150; at full HP the shake test passes on 85 of 256.
      const r1 = Math.floor(Math.random() * 151);
      const caught = r1 <= catchRate && Math.floor(Math.random() * 256) <= 85;
      if (caught) {
        game.ctx.sound.overworld("item");
        await say(`All right! ${name} was caught!`);
        const mon = game.makeMon(dex, level);
        const toParty = game.save.party.length < 6;
        if (toParty) game.save.party.push(mon);
        else game.save.storage.push(mon);
        game.register(dex, true);
        if (!toParty) await say(`${name} was transferred to the PC!`);
        return finish("caught");
      }
      await say(["You missed the POKéMON!", "Darn! The POKéMON broke free!", "Aww! It appeared to be caught!", "Shoot! It was so close too!"][Math.floor(Math.random() * 4)]);
      if (!safari.balls) return finish("run");
      return afterTurn();
    };
    void say(`Wild ${name} appeared!`).then(menu);
  });
}
