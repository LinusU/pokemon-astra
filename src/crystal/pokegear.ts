/** The Pokégear: clock, map card, phone and radio card. */
import { setMenuController } from "../ui/menu-controller";
import { escapeHtml, panel } from "../ui/shell";
import "../ui/menu-keys.css";
import { C, CONST, RAM } from "./symbols";
import type { CrystalGame } from "./runtime";
import { openCrystalMap } from "./town-map";
import { contact, contactName, call } from "./phone";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Radio stations, as the Pokégear's channels: their songs come from the cartridge. */
function stations(game: CrystalGame) {
  const time = game.timeOfDay(), day = game.now().getDay();
  const list: { name: string; music: string; flute?: boolean }[] = [
    { name: "OAK's POKéMON TALK", music: "MUSIC_POKEMON_TALK" },
    { name: "POKéMON MUSIC", music: day % 2 ? "MUSIC_POKEMON_LULLABY" : "MUSIC_POKEMON_MARCH" },
    { name: "LUCKY CHANNEL", music: "MUSIC_LUCKY_CHANNEL" },
    { name: "BUENA'S PASSWORD", music: "MUSIC_BUENAS_PASSWORD" },
  ];
  if (game.map.landmark === CONST.LANDMARK_RUINS_OF_ALPH) list.push({ name: "?????", music: "MUSIC_RUINS_OF_ALPH_RADIO" });
  if (game.ev("EVENT_CLEARED_RADIO_TOWER") === false && game.map.landmark === CONST.LANDMARK_MAHOGANY_TOWN) list.push({ name: "?????", music: "MUSIC_ROCKET_OVERTURE" });
  if (game.hasFlag("ENGINE_EXPN_CARD")) list.push({ name: "POKé FLUTE", music: "MUSIC_POKE_FLUTE_CHANNEL", flute: true });
  void time;
  return list.filter(s => CONST[s.music] !== undefined);
}

type Card = "clock" | "map" | "phone" | "radio";
/** What the radio card is tuned to, so that it opens on the same station. */
const tuned = new WeakMap<CrystalGame, string>();

/**
 * The Pokégear, held as on the cartridge: left and right turn its cards, up
 * and down run down the phone list or along the radio dial, A calls.
 */
export function openPokegear(game: CrystalGame, start: Card = "clock"): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  if (start === "map" && game.hasFlag("ENGINE_MAP_CARD")) {
    return openCrystalMap(game, { kind: "browse" }, "Pokégear · Map Card").then(() => {});
  }
  return new Promise(resolve => {
    const host = document.createElement("div");
    host.className = "crystal-overlay";
    game.layer.append(host);
    const all: [Card, string, boolean][] = [
      ["clock", "Clock", true], ["map", "Map", game.hasFlag("ENGINE_MAP_CARD")], ["phone", "Phone", true], ["radio", "Radio", game.hasFlag("ENGINE_RADIO_CARD")],
    ];
    const cards = all.filter(card => card[2]);
    const close = () => {
      host.remove();
      resolve();
    };
    const show = (card: Card, at?: number) => {
      const now = game.now(), radio = card === "radio" ? stations(game) : [];
      let body = "", act = "";
      if (card === "clock") body = `<p class="crystal-clock">${DAYS[now.getDay()]}<br><strong>${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}</strong><br>${["MORNING", "DAY", "NIGHT"][game.timeOfDay()]}</p>`;
      if (card === "map") {
        body = `<p class="crystal-clock">TOWN MAP</p>`;
        act = "Open";
      }
      if (card === "phone") {
        body = `<nav class="journey-list">${game.save.phone.map(i => `<button data-row="${i}">${escapeHtml(contactName(game, contact(game, i)))}</button>`).join("") || "<p>No numbers yet.</p>"}</nav>`;
        if (game.save.phone.length) act = "Call";
      }
      if (card === "radio") body = `<nav class="journey-list"><button data-row="-1">Off</button>${radio.map((s, i) => `<button data-row="${i}">${escapeHtml(s.name)}</button>`).join("")}</nav>`;
      const p = panel(host, "Pokégear", `<div class="crystal-gear-tabs">${cards.map(([id, label]) => `<button data-tab="${id}" class="${id === card ? "active" : ""}">${label}</button>`).join("")}</div>
        <div class="crystal-gear-card">${body}</div>
        <footer class="menu-keys"><span><kbd>◂▸</kbd> Card</span>${card === "radio" ? "<span><kbd>▲▼</kbd> Tune</span>" : ""}${act ? `<button id="act"><kbd>A</kbd> ${act}</button>` : ""}<button id="back"><kbd>B</kbd> Close</button></footer>`, "crystal-gear");
      const rows = [...p.querySelectorAll<HTMLButtonElement>("[data-row]")];
      let cursor = card === "radio" ? 1 + radio.findIndex(s => s.name === tuned.get(game)) : Math.min(at ?? 0, rows.length - 1);
      const tune = () => {
        const s = radio[cursor - 1];
        if (s) tuned.set(game, s.name);
        else tuned.delete(game);
        game.playMusic(s ? C(s.music) : undefined);
        // Hearing Buena's show gives the password she asks for at the Radio Tower.
        if (s?.name === "BUENA'S PASSWORD" && game.timeOfDay() === 2) game.poke(RAM.wBuenasPassword, 0x80 | Math.floor(Math.random() * 11));
      };
      const move = (index: number, user = true) => {
        if (!rows.length) return;
        rows[cursor]?.removeAttribute("aria-current");
        cursor = (index + rows.length) % rows.length;
        rows[cursor].setAttribute("aria-current", "true");
        rows[cursor].focus({ preventScroll: true });
        rows[cursor].scrollIntoView?.({ block: "nearest" });
        if (user && card === "radio") tune();
      };
      const turn = (step: number) => {
        const index = cards.findIndex(([id]) => id === card);
        show(cards[(index + step + cards.length) % cards.length][0]);
      };
      const activate = async () => {
        if (card === "map") await openCrystalMap(game, { kind: "browse" }, "Pokégear · Map Card");
        if (card !== "phone" || !rows.length) return;
        host.remove();
        await call(game, +rows[cursor].dataset.row!);
        game.layer.append(host);
        show("phone", cursor);
      };
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-tab]")) b.onclick = () => show(b.dataset.tab as Card);
      for (const [i, b] of rows.entries()) b.onclick = () => {
        move(i);
        void activate();
      };
      const button = p.querySelector<HTMLButtonElement>("#act");
      if (button) button.onclick = () => void activate();
      p.querySelector<HTMLButtonElement>("#back")!.onclick = close;
      setMenuController(p, action => {
        if (action === "left" || action === "right") turn(action === "left" ? -1 : 1);
        else if (action === "a") void activate();
        else move(cursor + (action === "up" ? -1 : 1));
      });
      move(cursor, false);
    };
    show(start === "map" ? "clock" : start);
  });
}
