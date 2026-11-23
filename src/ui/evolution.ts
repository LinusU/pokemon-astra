import type { Input } from "../game/input";
import { escapeHtml } from "./shell";
import "./evolution.css";

type Evolution = {
  from: string;
  to: string;
  name: string;
  evolvedName: string;
  reveal: () => void;
  ready: () => void;
  next: () => void;
  confirmLabel: string;
};

export async function playEvolution(layer: HTMLElement, evolution: Evolution) {
  const sparks = Array.from({ length: 16 }, (_, i) =>
    `<i style="--angle:${i * 22.5 + 9}deg;--delay:${(i % 5) * 65}ms;--distance:${1.1 + (i % 4) * 0.24}"><b></b></i>`,
  ).join("");
  layer.innerHTML = `
    <section class="evolution-scene" aria-label="Evolution" data-phase="intro">
      <div class="evolution-field" aria-hidden="true">
        <div class="evolution-aurora"></div>
        <div class="evolution-platform"></div>
        <div class="evolution-halo"></div>
        <div class="evolution-ring"></div>
        <div class="evolution-sparks">${sparks}</div>
        <img class="evolution-sprite evolution-before" alt="">
        <img class="evolution-sprite evolution-after" alt="">
      </div>
      <div class="evolution-caption">
        <p role="status">${escapeHtml(evolution.name)} is evolving…</p>
        <span class="advance" hidden>${escapeHtml(evolution.confirmLabel)} ▸</span>
      </div>
    </section>`;

  const stage = layer.querySelector<HTMLElement>(".evolution-scene")!;
  const before = stage.querySelector<HTMLImageElement>(".evolution-before")!;
  const after = stage.querySelector<HTMLImageElement>(".evolution-after")!;
  const status = stage.querySelector<HTMLElement>('[role="status"]')!;
  const arrow = stage.querySelector<HTMLElement>(".advance")!;
  before.src = evolution.from;
  after.src = evolution.to;
  // Decode both sprites before the silhouette swap so it always has a target.
  await Promise.allSettled([before.decode(), after.decode()]);

  async function phase(name: string, sprite: HTMLImageElement) {
    stage.dataset.phase = name;
    // Follow the sprite's CSS timeline, including when reduced motion cancels it.
    const animation = sprite.getAnimations()[0];
    if (animation) await animation.finished.catch(() => {});
  }

  await phase("charge", before);
  await phase("morph", after);
  const settling = phase("reveal", after);
  evolution.reveal();
  status.textContent = `${evolution.name} evolved into ${evolution.evolvedName}!`;
  await settling;
  evolution.ready();
  stage.dataset.phase = "complete";
  arrow.hidden = false;
  stage.addEventListener("click", evolution.next, { once: true });
}

/** Holds the controls while an evolution plays; A or B continues once it has finished. */
export function evolutionInput(layer: HTMLElement | undefined, input: Pick<Input, "hit">) {
  const scene = layer?.querySelector<HTMLElement>(".evolution-scene");
  if (!scene) return false;
  if (scene.dataset.phase === "complete" && (input.hit("a") || input.hit("b"))) scene.click();
  return true;
}
