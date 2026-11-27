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
const STICK_DEAD_ZONE = 0.35;

function pageInFront() {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus?.() === true;
}

function gamepadActions(pad: Gamepad, swapAB: boolean, suppressed: Set<number> | undefined) {
  const actions = new Set<Action>();
  const on = (i: number) => !!pad.buttons[i]?.pressed;
  if (on(0) && !suppressed?.has(0)) actions.add(swapAB ? "b" : "a");
  if (on(1) && !suppressed?.has(1)) actions.add(swapAB ? "a" : "b");
  if (on(9)) actions.add("menu");
  const dpad = on(12) || on(13) || on(14) || on(15);
  if (on(12) || (!dpad && (pad.axes[1] ?? 0) < -STICK_DEAD_ZONE)) actions.add("up");
  if (on(13) || (!dpad && (pad.axes[1] ?? 0) > STICK_DEAD_ZONE)) actions.add("down");
  if (on(14) || (!dpad && (pad.axes[0] ?? 0) < -STICK_DEAD_ZONE)) actions.add("left");
  if (on(15) || (!dpad && (pad.axes[0] ?? 0) > STICK_DEAD_ZONE)) actions.add("right");
  return actions;
}

/** Shared keyboard, multi-touch and last-actively-used Gamepad API controls. */
export class Input {
  private keyboard = new Map<string, Action>();
  private touch = new Map<number, Action[]>();
  private previous = new Set<Action>();
  private pending = new Set<Action>();
  private pressed = new Set<Action>();
  private active = -1;
  private swapAB = false;
  private padPolling: "active" | "blurred" | "resuming" | "denied" = "active";
  private pads: Gamepad[] = [];
  get connectedGamepads(): readonly Gamepad[] { return this.pads; }
  confirmLabel = window.matchMedia?.("(pointer: coarse)").matches ? "A" : "Z";
  private padStates = new Map<
    number,
    {
      id: string;
      buttons: boolean[];
      axes: number[];
      actions: Set<Action>;
      stick?: Readonly<{ x: number; y: number }>;
      stickHeldOnFocus: boolean;
      heldOnFocus?: Set<Action>;
      suppressed?: Set<number>;
    }
  >();

  get movementStick() {
    const state = this.padStates.get(this.active);
    if (!state || state.stickHeldOnFocus || state.buttons.slice(12, 16).some(Boolean)) return undefined;
    return state.stick;
  }

  setGamepadLayout(swapAB: boolean) {
    if (this.swapAB === swapAB) return;
    this.swapAB = swapAB;
    for (const state of this.padStates.values()) {
      // The button that confirmed the change must not immediately act as Back.
      state.suppressed = new Set([0, 1].filter(i => state.buttons[i]));
    }
  }

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
    // iOS does not always send focus back to the page, so any sign that it is in front again resumes polling.
    const resume = () => {
      if (this.padPolling === "blurred") this.padPolling = "resuming";
      else if (this.padPolling === "denied") this.padPolling = "active";
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("visibilitychange", () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") resume();
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
    if (this.padPolling === "blurred" && pageInFront()) this.padPolling = "resuming";
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
      const x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
      const stick = Math.hypot(x, y) > STICK_DEAD_ZONE ? { x, y } : undefined;
      // An idle receiver with an axis already held must not steal the controller.
      const used =
        buttons.some((down, i) => down && !previous?.buttons[i]) ||
        (!!previous && ((stick && !previous.stick) ||
          axes.some((direction, i) => direction !== 0 && direction !== previous.axes[i])));
      if (used && this.padPolling !== "resuming") {
        this.active = pad.index;
        this.confirmLabel = "A";
      }
      const suppressed = previous?.suppressed;
      if (suppressed) for (const index of suppressed) if (!buttons[index]) suppressed.delete(index);
      const actions = gamepadActions(pad, this.swapAB, suppressed);
      const heldOnFocus = this.padPolling === "resuming" ? new Set(actions) : previous?.heldOnFocus;
      // Each control held when returning must be released before it can fire again.
      if (heldOnFocus) {
        for (const action of heldOnFocus) {
          if (actions.has(action)) actions.delete(action);
          else heldOnFocus.delete(action);
        }
      }
      this.padStates.set(pad.index, {
        id: pad.id, buttons, axes, actions, stick,
        stickHeldOnFocus: !!stick && (this.padPolling === "resuming" || previous?.stickHeldOnFocus === true),
        suppressed: suppressed?.size ? suppressed : undefined,
        heldOnFocus: heldOnFocus?.size ? heldOnFocus : undefined,
      });
    }
    if (this.padPolling === "resuming") this.padPolling = "active";
    const actions = this.padStates.get(this.active)?.actions ?? [];
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
