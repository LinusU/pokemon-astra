import { escapeHtml, panel } from "../ui/shell";
import type { YellowGame } from "./runtime";

/** The Hall of Fame: record the winning team, then roll credits. */
export async function hallOfFame(game: YellowGame) {
  const save = game.save;
  const team = save.party.map(m => ({ species: m.species, level: m.level, dvs: [...m.dvs], nickname: m.nickname }));
  const records = (save.vars.hallOfFame ?? 0) + 1;
  save.vars.hallOfFame = records;
  game.music("MUSIC_HALL_OF_FAME");
  await new Promise<void>(resolve => {
    const p = panel(game.layer, "Hall of Fame",
      `<p>${escapeHtml(save.name)}'s winning team · record ${records}</p><div class="hall-party">${team.map(m =>
        `<div><img alt="" src="${game.ctx.sprite(m)}"><span>${escapeHtml(m.nickname || game.engine.species(m.species).name)}<br>Lv ${m.level}</span></div>`).join("")}</div><button id="continue">Continue</button>`,
      "champion-record");
    p.querySelector<HTMLButtonElement>("#continue")!.onclick = () => resolve();
    p.querySelector<HTMLButtonElement>("#continue")!.focus({ preventScroll: true });
  });
  game.music("MUSIC_CREDITS");
  await new Promise<void>(resolve => {
    const p = panel(game.layer, "The End",
      `<p>Congratulations, ${escapeHtml(save.name)}! You became the POKéMON LEAGUE champion with PIKACHU at your side.</p><p class="small">Maps, story and dialogue: your Pokémon Yellow cartridge. Engine: Pokémon Astra.</p><button id="continue">Continue</button>`,
      "champion-record");
    p.querySelector<HTMLButtonElement>("#continue")!.onclick = () => resolve();
    p.querySelector<HTMLButtonElement>("#continue")!.focus({ preventScroll: true });
  });
  game.layer.replaceChildren();
  game.music();
}
