/** The Pokégear: clock, map card, phone and radio card. */
import { escapeHtml, panel } from "../ui/shell";
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

export function openPokegear(game: CrystalGame, start: "clock" | "map" | "phone" | "radio" = "clock"): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  if (start === "map" && game.hasFlag("ENGINE_MAP_CARD")) {
    return openCrystalMap(game, { kind: "browse" }, "Pokégear · Map Card").then(() => {});
  }
  return new Promise(resolve => {
    const host = document.createElement("div");
    host.className = "crystal-overlay";
    game.layer.append(host);
    const tabs: [string, string, boolean][] = [
      ["clock", "Clock", true], ["map", "Map", game.hasFlag("ENGINE_MAP_CARD")], ["phone", "Phone", true], ["radio", "Radio", game.hasFlag("ENGINE_RADIO_CARD")],
    ];
    const close = () => {
      host.remove();
      resolve();
    };
    const show = (tab: string) => {
      let body = "";
      const now = game.now();
      if (tab === "clock") body = `<p class="crystal-clock">${DAYS[now.getDay()]}<br><strong>${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}</strong><br>${["MORNING", "DAY", "NIGHT"][game.timeOfDay()]}</p>`;
      if (tab === "phone") body = `<nav class="journey-list">${game.save.phone.map(i => `<button data-call="${i}">${escapeHtml(contactName(game, contact(game, i)))}</button>`).join("") || "<p>No numbers yet.</p>"}</nav>`;
      if (tab === "radio") body = `<nav class="journey-list">${stations(game).map((s, i) => `<button data-station="${i}">${escapeHtml(s.name)}</button>`).join("")}<button data-station="-1">Turn off</button></nav>`;
      const p = panel(host, "Pokégear", `<div class="crystal-gear-tabs">${tabs.filter(t => t[2]).map(([id, label]) => `<button data-tab="${id}" class="${id === tab ? "active" : ""}">${label}</button>`).join("")}</div>${body}<div class="buttons"><button class="secondary" id="back">Close</button></div>`, "crystal-gear");
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-tab]")) b.onclick = () => {
        if (b.dataset.tab === "map") void openCrystalMap(game, { kind: "browse" }, "Pokégear · Map Card");
        else show(b.dataset.tab!);
      };
      p.querySelector<HTMLButtonElement>("#back")!.onclick = close;
      p.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`)?.focus({ preventScroll: true });
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-call]")) b.onclick = async () => {
        host.remove();
        await call(game, +b.dataset.call!);
        game.layer.append(host);
        show("phone");
      };
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-station]")) b.onclick = () => {
        const s = stations(game)[+b.dataset.station!];
        game.playMusic(s ? C(s.music) : undefined);
        // Hearing Buena's show gives the password she asks for at the Radio Tower.
        if (s?.name === "BUENA'S PASSWORD" && game.timeOfDay() === 2) game.poke(RAM.wBuenasPassword, 0x80 | Math.floor(Math.random() * 11));
      };
    };
    show(start === "map" ? "clock" : start);
  });
}
