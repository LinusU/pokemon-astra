/** The Crystal adventures' start menu, party, Pack and naming screens. */
import { mountParty } from "../ui/party";
import { mountPartnerSummary } from "../ui/partner-summary";
import { mountBag, type BagPocket, type BagState } from "../ui/bag";
import { escapeHtml, panel } from "../ui/shell";
import { download } from "../game/storage";
import { C } from "./symbols";
import type { CrystalGame } from "./runtime";
import type { CrystalMon } from "./save";
import { itemTitle } from "./services";
import { FIELD_MOVES, knownFieldMoves, useFieldMove, type FieldMove } from "./field";

const JOHTO = ["Zephyr", "Hive", "Plain", "Fog", "Storm", "Mineral", "Glacier", "Rising"];
const KANTO = ["Boulder", "Cascade", "Thunder", "Rainbow", "Soul", "Marsh", "Volcano", "Earth"];
let selection = "party";
const bagState: BagState = {};

function rows(game: CrystalGame, usable?: (m: CrystalMon) => boolean) {
  return game.save.party.map((mon, slot) => ({
    name: mon.egg ? "EGG" : mon.nickname || game.engine.species(mon.species).name, sprite: game.ctx.sprite!(mon), level: mon.egg ? 0 : mon.level,
    status: mon.status, hp: mon.egg ? 0 : mon.hp, maxHp: mon.stats[0], note: slot === 0 ? "Lead" : undefined, disabled: usable ? !usable(mon) : false,
  }));
}

/** Picks a party Pokémon; headless (tests), the first that fits. */
export function choosePartyMon(game: CrystalGame, title: string, usable?: (m: CrystalMon) => boolean): Promise<number | undefined> {
  if (!game.ctx.layer || !game.ctx.sprite) {
    const i = game.save.party.findIndex(m => !usable || usable(m));
    return Promise.resolve(i < 0 ? undefined : i);
  }
  return game.modal(() => new Promise<number | undefined>(resolve => {
    game.closeText();
    const host = document.createElement("div");
    host.className = "crystal-overlay";
    game.layer.append(host);
    mountParty(host, {
      title, confirm: "Choose", rows: rows(game, usable),
      onSelect: slot => { host.remove(); resolve(slot); },
      onBack: () => { host.remove(); resolve(undefined); },
    });
  }));
}

/** Asks for a name, as the naming screen would. */
export function askName(game: CrystalGame, title: string, initial: string, max = 10): Promise<string | undefined> {
  if (!game.ctx.layer) return Promise.resolve(initial);
  return game.modal(() => new Promise<string | undefined>(resolve => {
    game.closeText();
    const host = document.createElement("div");
    host.className = "crystal-overlay";
    game.layer.append(host);
    const p = panel(host, title, `<label class="yellow-intro">Name<input id="name" maxlength="${max}" value="${escapeHtml(initial)}" autocomplete="off"></label><div class="buttons"><button id="confirm">OK</button><button class="secondary" id="back">Cancel</button></div>`);
    const input = p.querySelector<HTMLInputElement>("#name")!;
    input.focus();
    input.select();
    const done = (v: string | undefined) => { host.remove(); resolve(v); };
    p.querySelector<HTMLButtonElement>("#confirm")!.onclick = () => done(input.value.toUpperCase().replace(/[^A-Z0-9 .'-]/g, "").trim().slice(0, max) || undefined);
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => done(undefined);
    input.onkeydown = e => { if (e.key === "Enter") p.querySelector<HTMLButtonElement>("#confirm")!.click(); };
  }));
}
export async function rename(game: CrystalGame, mon: CrystalMon) {
  const name = await askName(game, "Nickname", mon.nickname || game.monName(mon.species));
  if (!name) return false;
  mon.nickname = name;
  return true;
}
/**
 * Asks whether to nickname a Pokémon, in the cartridge's words for how it
 * arrived: caught in battle ("Give a nickname to <MON>?"), received from a
 * script or the contest ("…the <MON> you received?"), or hatched.
 */
export async function askNickname(game: CrystalGame, mon: CrystalMon, label: NicknameText = "AskGiveNicknameText") {
  const at = (await import("./symbols")).TEXT[label];
  game.strings.set((await import("./symbols")).RAM.wStringBuffer1, game.monName(mon.species));
  if (at !== undefined) await game.writeText(at);
  else await game.say(`Give a nickname to ${game.monName(mon.species)}?`, false);
  if (await game.yesNo()) await rename(game, mon);
  game.closeText();
}

export type NicknameText = "AskGiveNicknameText" | "CaughtAskNicknameText" | "_BreedAskNicknameText";

export async function showDexEntry(game: CrystalGame, species: number) {
  if (!game.ctx.layer || !game.ctx.sprite) return;
  const { specimenCard } = await import("../ui/specimen");
  const data = game.engine.species(species), entry = game.engine.dexEntry(species);
  await game.modal(() => new Promise<void>(resolve => {
    const host = document.createElement("div");
    host.className = "crystal-overlay";
    game.layer.append(host);
    specimenCard(host, "Pokédex", { ...data, ...entry, image: game.ctx.sprite!(species) }, `№${String(species).padStart(3, "0")}`, "Close", () => { host.remove(); resolve(); });
  }));
}

function pocketOf(game: CrystalGame, id: number): BagPocket {
  const p = game.rom.itemPocket(id);
  if (p === C("BALL")) return "balls";
  if (p === C("KEY_ITEM")) return "key";
  if (p === C("TM_HM")) return "tms";
  return "items";
}

/** The start menu. Resolves with an action to run on the map, or nothing. */
export function openCrystalMenu(game: CrystalGame): Promise<(() => Promise<void>) | void> {
  return new Promise(resolve => {
    const close = () => { game.layer.replaceChildren(); game.persist(); resolve(); };
    const main = () => {
      const save = game.save;
      const options: [string, string][] = [
        ...(game.hasFlag("ENGINE_POKEDEX") ? [["dex", "Pokédex"] as [string, string]] : []),
        ...(save.party.length ? [["party", "Pokémon"] as [string, string]] : []),
        ["bag", "Pack"],
        ...(game.hasFlag("ENGINE_POKEGEAR") ? [["gear", "Pokégear"] as [string, string]] : []),
        ["card", save.name], ["save", "Save"], ["options", "Option"], ["journeys", "Journeys"], ["close", "Exit"],
      ];
      if (!options.some(([k]) => k === selection)) selection = options[0][0];
      const p = panel(game.layer, "Menu", `<nav class="journey-list" aria-label="Start menu">${options.map(([k, label]) =>
        `<button data-view="${k}"${k === "close" ? ' id="close"' : ""}>${escapeHtml(label)}</button>`).join("")}</nav>`, "journey-menu yellow-menu crystal-menu");
      p.querySelector<HTMLButtonElement>(`[data-view="${selection}"]`)?.focus({ preventScroll: true });
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-view]")) {
        const v = b.dataset.view!;
        b.onfocus = () => { selection = v; };
        b.onclick = () => { selection = v; view(v); };
      }
    };
    const message = (text: string, then = main) => {
      const p = panel(game.layer, "", `<p>${escapeHtml(text)}</p><div class="buttons"><button id="back">OK</button></div>`, "yellow-note");
      p.querySelector<HTMLButtonElement>("#back")!.onclick = then;
      p.querySelector<HTMLButtonElement>("#back")!.focus({ preventScroll: true });
    };
    const run = (action: () => Promise<void>) => { game.layer.replaceChildren(); resolve(action); };
    const view = (v: string, index = 0) => {
      const { save, engine } = game;
      if (v === "close") return close();
      if (v === "party") {
        game.layer.replaceChildren();
        mountParty(game.layer, {
          title: "POKéMON", initialSlot: index, confirm: "Summary", rows: rows(game),
          onSelect: async slot => {
            const mon = save.party[slot];
            if (mon.egg) return message("It's an EGG. It's making sounds inside. It's going to hatch soon!", () => view("party", slot));
            const moves = knownFieldMoves(mon);
            const pick = await game.choose(["Summary", ...moves.map(m => FIELD_MOVES[m].move.replace("_", " ")), "Switch"], { title: mon.nickname || engine.species(mon.species).name, cancel: true });
            if (pick === undefined) return view("party", slot);
            if (pick > 0 && pick <= moves.length) return run(() => useFieldMove(game, slot, moves[pick - 1] as FieldMove));
            if (pick === moves.length + 1) {
              const other = await choosePartyMon(game, "Switch with which POKéMON?");
              if (other !== undefined) [save.party[slot], save.party[other]] = [save.party[other], save.party[slot]];
              return view("party", other ?? slot);
            }
            mountPartnerSummary(game.layer, mon, {
              engine, image: game.ctx.sprite!(mon), itemName: () => mon.item ? itemTitle(game.rom.itemName(mon.item)) : "None",
              onBack: () => view("party", slot),
              onItem: () => void heldItem(game, slot).then(() => view("party", slot)),
            });
          },
          onBack: main,
        });
        return;
      }
      if (v === "bag") {
        game.layer.replaceChildren();
        const items = Object.entries(save.items).filter(([, n]) => n > 0).map(([key, count]) => ({
          key, count, name: itemTitle(game.rom.itemName(+key)), pocket: pocketOf(game, +key), action: "Use",
        }));
        mountBag(game.layer, {
          items, state: bagState, pockets: ["items", "balls", "key", "tms"],
          onUse: item => void (async () => {
            const id = +item.key;
            const choice = await game.choose(["USE", "GIVE", "REGISTER", "TOSS"], { title: item.name, cancel: true });
            if (choice === undefined) return view("bag");
            if (choice === 2) { save.vars.registered = id; return message(`${item.name} was registered.`, () => view("bag")); }
            if (choice === 3) {
              if (game.rom.itemPocket(id) === C("KEY_ITEM") || game.rom.itemPocket(id) === C("TM_HM") && !game.rom.itemPrice(id)) return message("That's too important to toss!", () => view("bag"));
              game.takeItem(id, save.items[id]);
              return view("bag");
            }
            if (choice === 1) {
              const slot = await choosePartyMon(game, "Give to which POKéMON?", m => !m.egg);
              if (slot !== undefined) {
                const mon = save.party[slot];
                if (mon.item) game.giveItem(mon.item);
                mon.item = id;
                game.takeItem(id);
              }
              return view("bag");
            }
            const { useItem } = await import("./items");
            const result = await useItem(game, id);
            if (typeof result === "function") return run(result);
            if (result === "close") return close();
            if (result) message(result, () => view("bag"));
            else view("bag");
          })(),
          onCancel: main,
        });
        return;
      }
      if (v === "gear") return run(async () => {
        const { openPokegear } = await import("./pokegear");
        await game.modal(() => openPokegear(game));
      });
      if (v === "dex") {
        const list = save.seen.slice().sort((a, b) => a - b).map(n => `<li><img alt="" src="${game.ctx.sprite!(n)}"><span>№${String(n).padStart(3, "0")} ${escapeHtml(engine.species(n).name)}</span><em>${save.caught.includes(n) ? "Caught" : "Seen"}</em></li>`);
        const p = panel(game.layer, "Pokédex", `<p>Seen ${save.seen.length} · Owned ${save.caught.length}</p><ul class="yellow-dex">${list.join("") || "<li>No Pokémon yet.</li>"}</ul><div class="buttons"><button id="back">Back</button></div>`, "yellow-dex-panel");
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "card") {
        const time = Math.floor(save.seconds / 60), b = game.badges();
        const badges = (names: string[], mask: number) => names.map((n, i) => `<span class="${mask & (1 << i) ? "earned" : ""}">${n}</span>`).join("");
        const p = panel(game.layer, save.name, `<dl class="yellow-card"><dt>ID</dt><dd>${String(save.playerId).padStart(5, "0")}</dd><dt>Money</dt><dd>¥${save.money}</dd><dt>Time</dt><dd>${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}</dd><dt>Pokédex</dt><dd>${save.caught.length} owned</dd></dl>
          <div class="yellow-badges">${badges(JOHTO, b.johto)}</div>${b.kanto ? `<div class="yellow-badges">${badges(KANTO, b.kanto)}</div>` : ""}
          <div class="buttons"><button id="back">Back</button></div>`, "yellow-card-panel");
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "save") {
        const p = panel(game.layer, "Save", `<p>${escapeHtml(game.summary().place)} · ${game.badges().count} badges</p><p>Your journey also saves itself as you walk.</p><div class="buttons"><button id="confirm">Save now</button><button class="secondary" id="export">Export backup</button><button class="secondary" id="back">Back</button></div>`);
        p.querySelector<HTMLButtonElement>("#confirm")!.onclick = async () => { await game.persist(true); message(`${save.name} saved the game.`); };
        p.querySelector<HTMLButtonElement>("#export")!.onclick = () => download(`pokemon-${save.adventure}-save.json`, save);
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "options") {
        const p = panel(game.layer, "Option", `<div class="preference-grid">
          <button id="speed">Battle speed<strong>${save.settings.battleSpeed}×</strong></button>
          <button id="music">Sound<strong>${game.ctx.sound?.enabled ? "On" : "Off"}</strong></button>
          <button id="gamepad">Controller A/B<strong>${save.settings.swapGamepadAB ? "Swapped" : "Standard"}</strong></button>
          <button id="movement">Movement<strong>${save.settings.movement === "grid" ? "Square by square" : "Free"}</strong></button>
          </div><div class="buttons"><button class="secondary" id="back">Back</button></div>`, "settings-screen");
        p.querySelector<HTMLButtonElement>("#speed")!.onclick = () => { save.settings.battleSpeed = save.settings.battleSpeed % 3 + 1; view("options"); };
        p.querySelector<HTMLButtonElement>("#music")!.onclick = () => {
          save.settings.music = !game.ctx.sound?.enabled;
          game.ctx.sound?.setEnabled(save.settings.music);
          if (save.settings.music) void game.ctx.sound?.unlock();
          view("options");
        };
        p.querySelector<HTMLButtonElement>("#gamepad")!.onclick = () => {
          save.settings.swapGamepadAB = !save.settings.swapGamepadAB;
          game.ctx.input.setGamepadLayout(save.settings.swapGamepadAB);
          view("options");
        };
        p.querySelector<HTMLButtonElement>("#movement")!.onclick = () => { save.settings.movement = save.settings.movement === "grid" ? "free" : "grid"; view("options"); };
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "journeys") {
        const p = panel(game.layer, "Leave this journey?", "<p>Your progress is saved. You can continue from the journey list.</p><div class=\"buttons\"><button id=\"leave\">All journeys</button><button class=\"secondary\" id=\"back\">Stay</button></div>");
        p.querySelector<HTMLButtonElement>("#leave")!.onclick = async () => { await game.persist(true); game.ctx.exit?.(); };
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
      }
    };
    main();
  });
}

async function heldItem(game: CrystalGame, slot: number) {
  const mon = game.save.party[slot];
  if (mon.item) {
    if (!game.giveItem(mon.item)) return game.say("The PACK is full.");
    mon.item = 0;
    return;
  }
  const items = Object.keys(game.save.items).map(Number).filter(id => game.save.items[id] > 0 && game.rom.itemPocket(id) === C("ITEM"));
  const pick = await game.choose(items.map(id => itemTitle(game.rom.itemName(id))), { title: "Give which item?", cancel: true });
  if (pick === undefined) return;
  mon.item = items[pick];
  game.takeItem(items[pick]);
}
