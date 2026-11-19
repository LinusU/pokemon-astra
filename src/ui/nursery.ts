import type { Engine, Pokemon } from "../engine";
import { canNest, collectPair, gender, leavePair } from "../game/nursery";
import type { Save } from "../game/save";
import { mountParty } from "./party";
import { escapeHtml as html, panel } from "./shell";
import "./nursery.css";

type Options = {
  save: Save;
  engine: Engine;
  sprite: (mon: Pokemon | number) => string;
  onSave: () => void;
  onClose: () => void;
};

export function openNursery(host: HTMLElement, options: Options) {
  const { save, engine, sprite } = options;
  const name = (mon: Pokemon) => mon.nickname || engine.species(mon.species).name;
  const img = (mon: Pokemon | number) => `<img src="${sprite(mon)}" alt="">`;
  const portraits = (mons: Pokemon[]) => mons.map(mon =>
    `<div>${img(mon)}<span>${html(name(mon))} ${gender(mon, engine)}</span></div>`).join("");

  function desk(note = "") {
    const nest = save.nursery;
    const ready = nest && save.steps >= nest.readyAt;
    const left = nest ? Math.max(0, Math.ceil(nest.readyAt - save.steps)) : 0;
    const held = nest?.parents ?? [];
    const title = "Reedhaven Nursery";
    let text = "Our reed beds are warm enough for Eggs. Leave two compatible Pokémon here while you explore.";
    if (save.egg) text = "Your Egg is warm in its sling. Walk with it until it hatches. You can check on it in the Key Items pocket.";
    else if (ready) text = "Your partners tucked an Egg into the reeds. You can carry it home in this woven sling.";
    else if (nest) text = `Your partners are settling into the reeds. Check the nest after ${left} more walking tiles.`;
    else if (save.party.length < 3) text += " Bring a party of three or more so a partner can stay with you.";
    const action = nest ? ready ? "Collect Egg and parents" : "Bring parents home" : "Choose a pair";
    const p = panel(host, title, `
      <div class="nest-portraits">${portraits(held) || img(253)}</div>
      <p role="status">${html(note || text)}</p>
      <div class="buttons">${!save.egg && (nest || save.party.length >= 3) ? `<button id="nest-action">${action}</button>` : ""}
      <button class="secondary" id="back">Leave</button></div>`, "nest-desk");
    p.querySelector("#nest-action")?.addEventListener("click", nest ? retrieve : () => pick());
    p.querySelector("#back")!.addEventListener("click", options.onClose);
  }

  function pick(first?: number) {
    host.replaceChildren();
    const choices = save.party.map((mon, i) => {
      const fits = first === undefined
        ? save.party.some((_, j) => canNest(save.party, i, j, engine))
        : canNest(save.party, first, i, engine);
      return { name: name(mon), sprite: sprite(mon), level: mon.level, hp: mon.hp,
        maxHp: mon.stats[0], status: mon.status, disabled: !fits,
        note: `${gender(mon, engine)}${i === first ? " · Selected" : !fits ? " · No match" : ""}` };
    });
    if (choices.every(row => row.disabled))
      return desk("This group has no nesting pair. Try adults from a shared Egg Group, one male and one female, or bring Ditto. Close relatives cannot pair. Keep a healthy partner with you.");
    mountParty(host, { title: first === undefined ? "Choose first parent" : "Choose its partner",
      confirm: first === undefined ? "Choose" : "Review", rows: choices,
      onSelect: i => first === undefined ? pick(i) : register(first, i),
      onBack: first === undefined ? () => desk() : () => pick(),
    });
  }

  function register(a: number, b: number) {
    const p = panel(host, "Leave this pair?", `<div class="nest-portraits">${portraits([save.party[a], save.party[b]])}</div>
      <p>They’ll stay with the keeper. Walk 96 tiles, then return to check the nest.</p>
      <div class="buttons"><button id="nest-leave">Leave pair</button><button id="back" class="secondary">Choose again</button></div>`, "nest-desk");
    p.querySelector("#nest-leave")!.addEventListener("click", () => {
      if (leavePair(save, a, b, engine)) options.onSave();
      desk();
    });
    p.querySelector("#back")!.addEventListener("click", () => pick(a));
  }

  function retrieve() {
    const nest = save.nursery!;
    const ready = save.steps >= nest.readyAt;
    const spots = 6 - save.party.length;
    const destination = spots >= 2 ? "Both parents will rejoin your party." : spots === 1
      ? `${name(nest.parents[0])} will join your party. ${name(nest.parents[1])} will go to the Center PC.` : "Both parents will go to the Center PC.";
    const p = panel(host, ready ? "Take the Egg?" : "Pick up early?",
      `<div class="nest-portraits">${ready ? img(253) : portraits(nest.parents)}</div>
      <p>${ready ? "The Egg will travel in your Key Items pocket." : "The pair will leave this nest before an Egg is laid."} ${html(destination)}</p>
      <div class="buttons"><button id="nest-collect">Pick up</button><button class="secondary" id="back">Back</button></div>`, "nest-desk");
    p.querySelector("#nest-collect")!.addEventListener("click", () => {
      collectPair(save, engine);
      options.onSave();
      desk(ready ? "You tucked the Egg into its sling. The shell will rock as you walk." : "Your partners are back. The reed beds are ready for another visit.");
    });
    p.querySelector("#back")!.addEventListener("click", () => desk());
  }

  desk();
}

export async function showHatch(host: HTMLElement, egg: string, baby: string, name: string,
  destination: string, sound: () => void, done: () => void) {
  const p = panel(host, "The Egg is hatching!", `<div class="hatch-stage"><img class="hatch-shell" src="${egg}" alt="Egg">
    <img class="hatch-baby" src="${baby}" alt="" hidden></div><p role="status">Something is tapping from inside the shell…</p>
    <button id="hatch-done" disabled>Continue</button>`, "nest-desk hatch-desk");
  const shell = p.querySelector<HTMLImageElement>(".hatch-shell")!;
  const child = p.querySelector<HTMLImageElement>(".hatch-baby")!;
  await Promise.allSettled([shell.decode(), child.decode()]);
  p.classList.add("hatching");
  await Promise.allSettled(shell.getAnimations().map(animation => animation.finished));
  shell.hidden = true;
  child.hidden = false;
  p.querySelector("h2")!.textContent = name + " hatched!";
  p.querySelector("p")!.textContent = destination;
  sound();
  const button = p.querySelector<HTMLButtonElement>("#hatch-done")!;
  button.disabled = false;
  button.onclick = done;
  button.focus({ preventScroll: true });
}
