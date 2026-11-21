import { mountParty } from "../ui/party";
import { mountPartnerSummary } from "../ui/partner-summary";
import { mountBag, type BagPocket, type BagState } from "../ui/bag";
import { escapeHtml, panel } from "../ui/shell";
import { download } from "../game/storage";
import { ITEM } from "./generated/symbols";
import type { YellowGame } from "./runtime";
import { titleCase } from "./runtime";
import { useYellowItem, itemPocket, itemDescription } from "./items";
import { FIELD_MOVES, knownFieldMoves, useFieldMove } from "./field";
import { choose } from "./services";

const BADGES = ["Boulder", "Cascade", "Thunder", "Rainbow", "Soul", "Marsh", "Volcano", "Earth"];
let selection = "party";
const bagState: BagState = {};

/** Yellow's start menu. Resolves when the player closes it. */
export function openYellowMenu(game: YellowGame): Promise<(() => Promise<void>) | void> {
  return new Promise(resolve => {
    const close = () => {
      game.layer.replaceChildren();
      game.persist();
      resolve();
    };
    const main = () => {
      const save = game.save;
      const options: [string, string][] = [
        ...(game.ev("EVENT_GOT_POKEDEX") ? [["dex", "Pokédex"] as [string, string]] : []),
        ...(save.party.length ? [["party", "Pokémon"] as [string, string]] : []),
        ["bag", "Item"], ["card", save.name], ["save", "Save"], ["options", "Option"], ["journeys", "Journeys"], ["close", "Exit"],
      ];
      if (!options.some(([k]) => k === selection)) selection = options[0][0];
      const p = panel(game.layer, "Menu", `<nav class="journey-list" aria-label="Start menu">${options.map(([k, label]) =>
        `<button data-view="${k}"${k === "close" ? ' id="close"' : ""}>${escapeHtml(label)}</button>`).join("")}</nav>`, "journey-menu yellow-menu");
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
    const view = (v: string, index = 0) => {
      const { save, engine } = game;
      if (v === "close") return close();
      if (v === "party") {
        game.layer.replaceChildren();
        mountParty(game.layer, {
          title: "POKéMON", initialSlot: index, confirm: "Summary",
          rows: save.party.map((mon, slot) => ({
            name: mon.nickname || engine.species(mon.species).name, sprite: game.ctx.sprite(mon), level: mon.level,
            status: mon.status, hp: mon.hp, maxHp: mon.stats[0], note: slot === 0 ? "Lead" : undefined,
          })),
          onSelect: async slot => {
            const mon = save.party[slot];
            const moves = knownFieldMoves(mon);
            if (moves.length) {
              const pick = await choose(game, mon.nickname || engine.species(mon.species).name, ["Summary", ...moves.map(m => FIELD_MOVES[m].name)]);
              if (pick === undefined) return view("party", slot);
              if (pick > 0) {
                game.layer.replaceChildren();
                resolve(() => useFieldMove(game, slot, moves[pick - 1]));
                return;
              }
            }
            mountPartnerSummary(game.layer, mon, {
              engine, image: game.ctx.sprite(mon), itemName: () => "",
              onBack: () => view("party", slot),
              onLead: slot > 0 ? () => {
                [save.party[0], save.party[slot]] = [mon, save.party[0]];
                view("party");
              } : undefined,
            });
          },
          onBack: main,
        });
        return;
      }
      if (v === "bag") {
        game.layer.replaceChildren();
        const items = Object.entries(save.items).filter(([, n]) => n > 0).map(([key, count]) => {
          const id = +key;
          return {
            key, count, name: titleItem(game.rom.itemName(id)),
            pocket: itemPocket(id) as BagPocket, description: itemDescription(game, id), action: "Use",
          };
        });
        mountBag(game.layer, {
          items, state: bagState, pockets: ["items", "balls", "key"],
          onUse: item => void useYellowItem(game, +item.key).then(result => {
            if (typeof result === "function") {
              game.layer.replaceChildren();
              return resolve(result);
            }
            if (result === "close") return close();
            if (result) message(result, () => view("bag"));
            else view("bag");
          }),
          onCancel: main,
        });
        return;
      }
      if (v === "dex") {
        const rows = save.seen.slice().sort((a, b) => a - b).map(n => {
          const name = engine.species(n).name;
          return `<li><img alt="" src="${game.ctx.sprite(n)}"><span>№${String(n).padStart(3, "0")} ${escapeHtml(name)}</span><em>${save.caught.includes(n) ? "Caught" : "Seen"}</em></li>`;
        });
        const p = panel(game.layer, "Pokédex", `<p>Seen ${save.seen.filter(n => n <= 151).length} · Owned ${save.caught.filter(n => n <= 151).length}</p><ul class="yellow-dex">${rows.join("") || "<li>No Pokémon yet.</li>"}</ul><div class="buttons"><button id="back">Back</button></div>`, "yellow-dex-panel");
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "card") {
        const time = Math.floor(save.seconds / 60);
        const p = panel(game.layer, `${save.name}`, `<dl class="yellow-card"><dt>Money</dt><dd>₽${save.money}</dd><dt>Time</dt><dd>${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}</dd><dt>Pokédex</dt><dd>${save.caught.length} owned</dd></dl>
          <div class="yellow-badges">${BADGES.map((b, i) => `<span class="${save.badges & (1 << i) ? "earned" : ""}">${b}</span>`).join("")}</div>
          <div class="buttons"><button id="back">Back</button></div>`, "yellow-card-panel");
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "save") {
        const p = panel(game.layer, "Save", `<p>${escapeHtml(game.summary().place)} · ${save.caught.length} owned</p><p>Your journey also saves itself as you walk.</p><div class="buttons"><button id="confirm">Save now</button><button class="secondary" id="export">Export backup</button><button class="secondary" id="back">Back</button></div>`);
        p.querySelector<HTMLButtonElement>("#confirm")!.onclick = async () => {
          await game.persist(true);
          message(`${save.name} saved the game!`);
        };
        p.querySelector<HTMLButtonElement>("#export")!.onclick = () => download("pokemon-yellow-save.json", save);
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "options") {
        const p = panel(game.layer, "Option", `<div class="preference-grid">
          <button id="speed">Battle speed<strong>${save.settings.battleSpeed}×</strong></button>
          <button id="music">Sound<strong>${game.ctx.sound.enabled ? "On" : "Off"}</strong></button>
          <button id="gamepad">Controller A/B<strong>${save.settings.swapGamepadAB ? "Swapped" : "Standard"}</strong></button>
          <button id="movement">Movement<strong>${save.settings.movement === "grid" ? "Square by square" : "Free"}</strong></button>
          </div><div class="buttons"><button class="secondary" id="back">Back</button></div>`, "settings-screen");
        p.querySelector<HTMLButtonElement>("#speed")!.onclick = () => { save.settings.battleSpeed = save.settings.battleSpeed % 3 + 1; view("options"); };
        p.querySelector<HTMLButtonElement>("#music")!.onclick = () => {
          save.settings.music = !game.ctx.sound.enabled;
          game.ctx.sound.setEnabled(save.settings.music);
          if (save.settings.music) void game.ctx.sound.unlock();
          view("options");
        };
        p.querySelector<HTMLButtonElement>("#gamepad")!.onclick = () => {
          save.settings.swapGamepadAB = !save.settings.swapGamepadAB;
          game.ctx.input.setGamepadLayout(save.settings.swapGamepadAB);
          view("options");
        };
        p.querySelector<HTMLButtonElement>("#movement")!.onclick = () => {
          save.settings.movement = save.settings.movement === "grid" ? "free" : "grid";
          view("options");
        };
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
        return;
      }
      if (v === "journeys") {
        const p = panel(game.layer, "Leave this journey?", "<p>Your progress is saved. You can continue from the journey list.</p><div class=\"buttons\"><button id=\"leave\">All journeys</button><button class=\"secondary\" id=\"back\">Stay</button></div>");
        p.querySelector<HTMLButtonElement>("#leave")!.onclick = async () => {
          await game.persist(true);
          game.ctx.exit();
        };
        p.querySelector<HTMLButtonElement>("#back")!.onclick = main;
      }
    };
    main();
  });
}

export function titleItem(name: string) {
  return titleCase(name).replace(/Poké/i, "Poké").replace(/\bHm/, "HM").replace(/\bTm/, "TM").replace(/\bPp\b/, "PP").replace(/\bS\.s\./i, "S.S.");
}
void ITEM;
