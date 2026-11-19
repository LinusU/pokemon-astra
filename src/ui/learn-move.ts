import "./learn-move.css";
import type { Engine, Pokemon } from "../engine";
import { typeNames } from "../game/type-names";
import { panel, escapeHtml as html } from "./shell";

type LessonMove = { name: string; description?: string };

export function moveComparison(known: LessonMove, candidate: LessonMove) {
  return `<dl class="move-comparison"><div><dt>Forget ${html(known.name)}</dt><dd>${html(known.description ?? "")}</dd></div>
    <div><dt>Learn ${html(candidate.name)}</dt><dd>${html(candidate.description ?? "")}</dd></div></dl>`;
}

export function chooseEvolutionMove(host: HTMLElement, mon: Pokemon, id: number, engine: Engine, done: (slot?: number) => void) {
  const candidate = engine.move(id, mon.dvs);
  const name = mon.nickname || engine.species(mon.species).name;
  const describe = (move: typeof candidate) => [typeNames[move.type] ?? "???", move.power > 1 ? `Power ${move.power}` : move.power === 0 ? "Status" : "Special power"].join(" · ");
  function choose(focus = 0) {
    const p = panel(host, "Learn " + candidate.name + "?", `<p>${html(candidate.description)}</p>
      <p class="lesson-new">${describe(candidate)} · ${candidate.pp} PP</p>
      <div class="lesson-choices">${mon.moves.map((move, i) => {
        const known = engine.move(move, mon.dvs);
        return `<button data-slot="${i}"><strong>${html(known.name)}</strong><span>${describe(known)} · ${mon.pp[i] & 63} PP</span></button>`;
      }).join("")}</div><button class="secondary" id="back">Keep current moves</button>`, "lesson-panel lesson-choice");
    for (const b of p.querySelectorAll<HTMLButtonElement>("[data-slot]"))
      b.onclick = () => confirm(Number(b.dataset.slot));
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => confirm();
    p.querySelector<HTMLButtonElement>(`[data-slot="${focus}"]`)?.focus({ preventScroll: true });
  }
  function confirm(slot?: number) {
    const skip = slot === undefined;
    const old = skip ? undefined : engine.move(mon.moves[slot], mon.dvs);
    const p = panel(host, old ? "Replace a move?" : "Keep current moves?",
      `${old ? moveComparison(old, candidate) : `<p>${html(name)} will give up on ${html(candidate.name)}.</p><p>${html(candidate.description)}</p>`}
      <div class="buttons"><button id="back">Choose again</button><button id="learn-confirm">${skip ? "Keep current moves" : "Learn " + html(candidate.name)}</button></div>`, "lesson-panel");
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => choose(slot);
    p.querySelector<HTMLButtonElement>("#learn-confirm")!.onclick = () => done(slot);
  }
  choose();
}
