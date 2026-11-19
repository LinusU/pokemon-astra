import { surveyStipend } from "../game/collection";
import { escapeHtml, panel, type PanelCursor } from "./shell";

export function openFieldGuide(layer: HTMLElement, back: () => void, swapped: boolean, controllers: readonly Gamepad[]) {
  const pages = [
    ["Controls", `<dl class="guide-controls"><dt>Move</dt><dd>Arrows, WASD, D-pad or left stick</dd><dt>Confirm</dt><dd>Z, Enter, Space or ${swapped ? "controller button 1" : "A"}</dd><dt>Back</dt><dd>X, Esc or ${swapped ? "controller button 0" : "B"}</dd><dt>Menu</dt><dd>M, Tab or Start</dd></dl><p>Hold Shift to run faster. Slide a thumb on the touch D-pad to steer.</p>${controllers.length ? `<p>Connected · ${controllers.map(pad => escapeHtml(pad.id)).join(", ")}</p>` : ""}`],
    ["Catch Pokémon", `<p>Find wild Pokémon in tall grass. Weaken one, then throw a Poké Ball from your Bag.</p><p>Alder pays ₽${surveyStipend} for each new wild species you catch. With six in your party, catches go to the Center PC.</p>`],
    ["Train your team", "<p>Partners who fight or hold Exp. Share gain experience. Defeated road trainers offer practice battles.</p><p>Walking raises friendship. Party → Growth shows how a partner evolves. Centers heal your whole team.</p>"],
    ["Follow the beacons", "<p>The Journal tracks your next objective and local requests. Inspect a blocked path to record it.</p><p>Map shows the way to your objective. Local map marks nearby services. Each badge unlocks a field ability.</p>"],
    ["Offline play", "<p>Open Astra online, import your cartridge and wait for “Offline ready.” Export a backup from Options.</p><p>To install on iPhone or iPad, use Share → Add to Home Screen. On Android, use Install app or Add to Home screen.</p>"],
  ];
  const cursor: PanelCursor = {};
  function show(index: number) {
    const [heading, body] = pages[index];
    const p = panel(layer, "Field basics", `<div class="guide-pager"><button id="prev" aria-label="Previous topic">◀</button><h3>${escapeHtml(heading)} <small>${index + 1}/${pages.length}</small></h3><button id="next" aria-label="Next topic">▶</button></div><div class="guide-text">${body}</div><button id="back" class="secondary">Back</button>`, "field-guide", cursor);
    p.querySelector<HTMLButtonElement>("#prev")!.onclick = () => show((index + pages.length - 1) % pages.length);
    p.querySelector<HTMLButtonElement>("#next")!.onclick = () => show((index + 1) % pages.length);
    p.querySelector<HTMLButtonElement>("#back")!.onclick = back;
    if (!cursor.key) p.querySelector<HTMLButtonElement>("#next")!.focus({ preventScroll: true });
  }
  show(0);
}
