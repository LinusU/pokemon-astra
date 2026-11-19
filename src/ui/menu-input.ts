import type { Input } from "../game/input";
import { summaryController } from "./partner-summary";
import { pcController } from "./storage-pc";
import { journalController } from "./journal";
import { dexController } from "./pokedex";
import { bagController } from "./bag";

const directions = ["up", "down", "left", "right"] as const;
type Direction = (typeof directions)[number];
type Bounds = Pick<DOMRectReadOnly, "left" | "right" | "top" | "bottom">;
type ButtonPosition = { button: HTMLButtonElement; bounds: Bounds };

function destination(
  buttons: ButtonPosition[],
  from: Bounds,
  direction: Direction,
) {
  const vertical = direction === "down" || direction === "up";
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const crossLow = vertical ? "left" : "top";
  const crossHigh = vertical ? "right" : "bottom";
  let best: (typeof buttons)[number] | undefined;
  let lowest = Infinity;
  for (const candidate of buttons) {
    const bounds = candidate.bounds;
    const primary =
      sign *
      (vertical
        ? (bounds.top + bounds.bottom - from.top - from.bottom) / 2
        : (bounds.left + bounds.right - from.left - from.right) / 2);
    if (primary <= 1) continue;
    const gap = Math.max(
      from[crossLow] - bounds[crossHigh],
      bounds[crossLow] - from[crossHigh],
    );
    if (!vertical && gap >= 0) continue;
    const cross =
      Math.abs(
        bounds[crossLow] + bounds[crossHigh] - from[crossLow] - from[crossHigh],
      ) / 2;
    const score = primary + cross / 4 + Math.max(0, gap) * 2;
    if (score < lowest) {
      best = candidate;
      lowest = score;
    }
  }
  return best;
}

export class MenuInput {
  private start?: Element | ReturnType<typeof dexController> | null;
  private repeating?: Direction;
  private repeatAt = 0;

  update(
    layer: HTMLElement,
    input: Pick<Input, "hit" | "held">,
    now: number,
    battle: boolean,
  ) {
    const controller = bagController(layer) ?? dexController(layer) ?? journalController(layer) ?? pcController(layer) ?? summaryController(layer);
    const party = layer.querySelector<HTMLElement>(".party-screen");
    const scroller =
      layer.querySelector<HTMLElement>(
        battle ? ".battle-controls" : ".panel",
      ) ?? layer;
    // Battle submenus replace their buttons without replacing the scene.
    const start =
      controller ?? party ??
      (battle
        ? scroller.querySelector("button:not(:disabled)")
        : layer.firstElementChild);
    const opened = start !== this.start;
    if (opened) this.repeating = undefined;
    this.start = start;
    const pressed = directions.find((direction) => input.hit(direction));
    const held = this.repeating && input.held(this.repeating);
    if (!pressed && !held) this.repeating = undefined;
    const direction =
      pressed ??
      ((!battle || controller || party) && held && now >= this.repeatAt
        ? this.repeating
        : undefined);
    if (pressed) {
      this.repeating = pressed;
      this.repeatAt = now + 300;
    } else if (direction) this.repeatAt = now + 95;
    const confirm = input.hit("a");
    if (!opened && !direction && !confirm) return;
    if (controller) {
      if (confirm) controller.input("a");
      else if (direction) controller.input(direction);
      return;
    }
    if (party) {
      const current = party.querySelector<HTMLButtonElement>('[aria-current="true"]');
      if (!current) return;
      if (confirm) current.click();
      else if (direction === "up" || direction === "down") {
        const rows = Array.from(party.querySelectorAll<HTMLButtonElement>("[data-slot]:enabled"));
        const index = rows.indexOf(current);
        const next = rows[index + (direction === "up" ? -1 : 1)];
        next?.focus({ preventScroll: true });
      }
      return;
    }

    const viewport = scroller.getBoundingClientRect();
    const buttons = Array.from(
      scroller.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    )
      .map((button) => ({ button, bounds: button.getBoundingClientRect() }))
      .filter(
        ({ bounds }) =>
          bounds.right > bounds.left && bounds.bottom > bounds.top,
      );
    const visible = (bounds: Bounds) =>
      bounds.bottom > viewport.top + 2 &&
      bounds.top < viewport.bottom - 2 &&
      bounds.right > viewport.left &&
      bounds.left < viewport.right;
    const marked = scroller.querySelector('[aria-current="true"]');
    const selected = buttons.find(({ button }) => button === marked);
    const focused = buttons.find(({ button }) => button === layer.ownerDocument.activeElement);
    const previous = selected ?? focused;
    const firstVisible = buttons.find(({ bounds }) => visible(bounds));
    const menuStart =
      opened && scroller.querySelector(".menu-grid, [data-menu-start]")
        ? buttons[0]
        : undefined;
    const current =
      previous && visible(previous.bounds) ? previous : (firstVisible ?? menuStart);
    const focus = ({ button, bounds }: ButtonPosition) => {
      button.focus({ preventScroll: true });
      if (bounds.top < viewport.top)
        scroller.scrollTop -= viewport.top - bounds.top;
      else if (bounds.bottom > viewport.bottom)
        scroller.scrollTop += bounds.bottom - viewport.bottom;
    };
    if (confirm) {
      if (selected && !visible(selected.bounds)) {
        focus(selected);
        return;
      }
      current?.button.click();
      return;
    }
    if (battle && buttons.length <= 1) return;
    if (opened && current && !focused) {
      focus(current);
      if (!visible(current.bounds)) return;
    }
    if (!direction) return;

    const vertical = direction === "down" || direction === "up";
    const next = current && destination(buttons, current.bounds, direction);
    const nearby =
      next &&
      next.bounds.top < viewport.bottom + 18 &&
      next.bounds.bottom > viewport.top - 18;
    if (next && (visible(next.bounds) || (vertical && nearby) || battle)) {
      focus(next);
    } else if (!battle && vertical) {
      const step = Math.max(24, scroller.clientHeight * 0.24);
      scroller.scrollTop += direction === "down" ? step : -step;
      // Text-heavy panels can reveal their first action only after scrolling.
      const inView = (entry: ButtonPosition) =>
        visible(entry.button.getBoundingClientRect());
      if (!previous || !inView(previous))
        buttons.find(inView)?.button.focus({ preventScroll: true });
    } else if (current && !focused) {
      current.button.focus({ preventScroll: true });
    }
  }
}
