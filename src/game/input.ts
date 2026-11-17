export type Action =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "menu"
  | "speed";
const keys: Record<string, Action> = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  z: "a",
  Enter: "a",
  " ": "a",
  x: "b",
  Escape: "b",
  Tab: "menu",
  m: "menu",
  Shift: "speed",
};

/** Shared keyboard, multi-touch and last-actively-used Gamepad API controls. */
export class Input {
  private keyboard = new Map<string, Action>();
  private touch = new Map<number, Action>();
  private previous = new Set<Action>();
  private pending = new Set<Action>();
  private pressed = new Set<Action>();
  private active = -1;
  private padStates = new Map<
    number,
    { buttons: boolean[]; axes: boolean[] }
  >();

  constructor() {
    window.addEventListener("keydown", (event) => {
      const action = keys[event.key] || keys[event.key.toLowerCase()];
      if (!action) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" &&
            !["file", "button", "checkbox", "radio"].includes(
              (target as HTMLInputElement).type,
            )))
      )
        return;
      event.preventDefault();
      const code = event.code || event.key;
      if (!this.keyboard.has(code)) this.pending.add(action);
      this.keyboard.set(code, action);
    });
    window.addEventListener("keyup", (event) =>
      this.keyboard.delete(event.code || event.key),
    );
    window.addEventListener("blur", () => {
      this.keyboard.clear();
      this.touch.clear();
      this.pending.clear();
      this.previous.clear();
    });
  }

  bind(element: HTMLElement, action: Action) {
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.touch.set(event.pointerId, action);
      this.pending.add(action);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      element.addEventListener(name, (event) =>
        this.touch.delete((event as PointerEvent).pointerId),
      );
    }
  }

  update() {
    const pads = Array.from(navigator.getGamepads?.() || []).filter(
      (p): p is Gamepad => !!p && p.connected !== false,
    );
    for (const pad of pads) {
      const previous = this.padStates.get(pad.index);
      const buttons = pad.buttons.map((button) => button.pressed);
      const axes = pad.axes.slice(0, 2).map((axis) => Math.abs(axis) > 0.4);
      // An idle receiver with an axis already held must not steal the controller.
      const used =
        buttons.some((down, i) => down && !previous?.buttons[i]) ||
        (!!previous && axes.some((down, i) => down && !previous.axes[i]));
      if (used) this.active = pad.index;
      this.padStates.set(pad.index, { buttons, axes });
    }
    const pad = pads.find((p) => p.index === this.active);
    const actions = new Set<Action>();
    if (pad) {
      const on = (i: number) => !!pad.buttons[i]?.pressed;
      if (on(0)) actions.add("a");
      if (on(1)) actions.add("b");
      if (on(9)) actions.add("menu");
      const horizontal = on(14) || on(15),
        vertical = on(12) || on(13);
      if (on(12) || (!vertical && (pad.axes[1] ?? 0) < -0.35))
        actions.add("up");
      if (on(13) || (!vertical && (pad.axes[1] ?? 0) > 0.35))
        actions.add("down");
      if (on(14) || (!horizontal && (pad.axes[0] ?? 0) < -0.35))
        actions.add("left");
      if (on(15) || (!horizontal && (pad.axes[0] ?? 0) > 0.35))
        actions.add("right");
    }
    const now = new Set([
      ...this.keyboard.values(),
      ...this.touch.values(),
      ...actions,
    ]);
    this.pressed = new Set([
      ...this.pending,
      ...[...now].filter((action) => !this.previous.has(action)),
    ]);
    this.pending.clear();
    this.previous = now;
  }
  held(action: Action) {
    return this.previous.has(action);
  }
  hit(action: Action) {
    return this.pressed.has(action);
  }
}
