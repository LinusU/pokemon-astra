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
  private touch = new Map<number, Action[]>();
  private previous = new Set<Action>();
  private pending = new Set<Action>();
  private pressed = new Set<Action>();
  private active = -1;
  private padPolling: "active" | "blurred" | "resuming" | "denied" = "active";
  private pads: Gamepad[] = [];
  get connectedGamepads(): readonly Gamepad[] { return this.pads; }
  confirmLabel = window.matchMedia?.("(pointer: coarse)").matches ? "A" : "Z";
  private padStates = new Map<
    number,
    { id: string; buttons: boolean[]; axes: number[] }
  >();

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
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
      this.confirmLabel = "Z";
      const code = event.code || event.key;
      if (event.repeat) return;
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
      this.pressed.clear();
      this.previous.clear();
      this.active = -1;
      this.padPolling = "blurred";
    });
    window.addEventListener("focus", () => {
      if (this.padPolling === "blurred") this.padPolling = "resuming";
    });
  }

  bind(element: HTMLElement, action: Action) {
    this.bindPointer(element, () => [action]);
  }

  bindDpad(element: HTMLElement) {
    const paint = () => {
      element.dataset.held = [...this.touch.values()].flat().join(" ");
    };
    this.bindPointer(element, event => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 2 - 1;
      const y = (event.clientY - rect.top) / rect.height * 2 - 1;
      if (Math.max(Math.abs(x), Math.abs(y)) > 1) return [];
      const axes: Action[] = [];
      if (Math.abs(x) > 1 / 3) axes.push(x < 0 ? "left" : "right");
      if (Math.abs(y) > 1 / 3) axes.push(y < 0 ? "up" : "down");
      return axes;
    }, paint);
    window.addEventListener("blur", paint);
  }

  private bindPointer(element: HTMLElement, read: (event: PointerEvent) => Action[], paint?: () => void) {
    const update = (event: PointerEvent) => {
      const previous = this.touch.get(event.pointerId);
      const next = read(event);
      for (const action of next) if (!previous?.includes(action)) this.pending.add(action);
      this.touch.set(event.pointerId, next);
      paint?.();
    };
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.confirmLabel = "A";
      update(event);
    });
    if (paint) element.addEventListener("pointermove", event => {
      if (this.touch.has(event.pointerId) && element.hasPointerCapture(event.pointerId)) update(event);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      element.addEventListener(name, (event) => {
        this.touch.delete((event as PointerEvent).pointerId);
        paint?.();
      });
    }
  }

  private pollGamepads() {
    if (this.padPolling === "blurred" || this.padPolling === "denied") return [];
    try {
      return Array.from(navigator.getGamepads?.() || []).filter(
        (p): p is Gamepad => !!p && p.connected !== false,
      );
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
      // A frame can run without gamepad permission. Retry when focus returns.
      this.padPolling = "denied";
      return [];
    }
  }

  update() {
    const pads = this.pads = this.pollGamepads();
    for (const [index, state] of this.padStates) {
      if (pads.some(pad => pad.index === index && pad.id === state.id)) continue;
      this.padStates.delete(index);
      if (this.active === index) this.active = -1;
    }
    for (const pad of pads) {
      const previous = this.padStates.get(pad.index);
      const buttons = pad.buttons.map((button) => button.pressed);
      const axes = pad.axes.slice(0, 2).map(axis => Math.abs(axis) > 0.4 ? Math.sign(axis) : 0);
      // An idle receiver with an axis already held must not steal the controller.
      const used =
        buttons.some((down, i) => down && !previous?.buttons[i]) ||
        (!!previous && axes.some((direction, i) => direction !== 0 && direction !== previous.axes[i]));
      if (used && this.padPolling !== "resuming") {
        this.active = pad.index;
        this.confirmLabel = "A";
      }
      this.padStates.set(pad.index, { id: pad.id, buttons, axes });
    }
    if (this.padPolling === "resuming") this.padPolling = "active";
    const pad = pads.find((p) => p.index === this.active);
    const actions = new Set<Action>();
    if (pad) {
      const on = (i: number) => !!pad.buttons[i]?.pressed;
      if (on(0)) actions.add("a");
      if (on(1)) actions.add("b");
      if (on(9)) actions.add("menu");
      const dpad = on(12) || on(13) || on(14) || on(15);
      if (on(12) || (!dpad && (pad.axes[1] ?? 0) < -0.35))
        actions.add("up");
      if (on(13) || (!dpad && (pad.axes[1] ?? 0) > 0.35))
        actions.add("down");
      if (on(14) || (!dpad && (pad.axes[0] ?? 0) < -0.35))
        actions.add("left");
      if (on(15) || (!dpad && (pad.axes[0] ?? 0) > 0.35))
        actions.add("right");
    }
    const now = new Set([
      ...this.keyboard.values(),
      ...[...this.touch.values()].flat(),
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
