import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { heldHeading, walkFreely } from "../src/game/free-movement";
import { Input } from "../src/game/input";

let surface: EventTarget;
let pads: Gamepad[];
function key(type: string, key: string, code = key, modifiers = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { key, code }, modifiers);
  surface.dispatchEvent(event);
  return event;
}
function pad(index: number, axes = [0, 0], pressed: number[] = []): Gamepad {
  return {
    index,
    connected: true,
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({
      pressed: pressed.includes(i),
      touched: false,
      value: 0,
    })),
  } as Gamepad;
}
beforeEach(() => {
  surface = new EventTarget();
  pads = [];
  vi.stubGlobal("window", surface);
  vi.stubGlobal("navigator", { getGamepads: () => pads });
});
afterEach(() => vi.unstubAllGlobals());
describe("game input", () => {
  it("does not lose a quick confirm between animation frames or repeat it while held", () => {
    const input = new Input();
    key("keydown", "z", "KeyZ");
    key("keyup", "z", "KeyZ");
    input.update();
    expect(input.hit("a")).toBe(true);
    expect(input.held("a")).toBe(false);
    input.update();
    expect(input.hit("a")).toBe(false);
    key("keydown", "z", "KeyZ");
    input.update();
    expect(input.hit("a")).toBe(true);
    key("keydown", "z", "KeyZ");
    input.update();
    expect(input.hit("a")).toBe(false);
  });
  it("keeps an aliased direction held until both physical keys are released", () => {
    const input = new Input();
    key("keydown", "w", "KeyW");
    key("keydown", "ArrowUp");
    key("keyup", "w", "KeyW");
    input.update();
    expect(input.held("up")).toBe(true);
    key("keyup", "ArrowUp");
    input.update();
    expect(input.held("up")).toBe(false);
  });
  it("leaves browser shortcuts alone while keeping Shift available to run", () => {
    const input = new Input();
    expect(key("keydown", "w", "KeyW", { metaKey: true }).defaultPrevented).toBe(false);
    expect(key("keydown", "s", "KeyS", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key("keydown", "ArrowLeft", "ArrowLeft", { altKey: true }).defaultPrevented).toBe(false);
    input.update();
    expect(input.held("up") || input.held("down") || input.held("left")).toBe(false);
    key("keydown", "Shift", "ShiftLeft", { shiftKey: true });
    key("keydown", "W", "KeyW", { shiftKey: true });
    input.update();
    expect(input.held("up") && input.held("speed")).toBe(true);
  });
  it("keeps playing with keyboard input when the browser denies Gamepad access", () => {
    const getGamepads = vi.fn(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.stubGlobal("navigator", { getGamepads });
    const input = new Input();
    key("keydown", "z", "KeyZ");
    input.update();
    expect(input.hit("a")).toBe(true);
    input.update();
    expect(getGamepads).toHaveBeenCalledTimes(1);
    expect(input.connectedGamepads).toEqual([]);
  });
  it("requires fresh controller input after switching windows", () => {
    const input = new Input();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
    surface.dispatchEvent(new Event("blur"));
    input.update();
    expect(input.held("a")).toBe(false);
    pads = [pad(0, [0, 1], [1])];
    input.update();
    expect(input.held("b") || input.held("down")).toBe(false);
    surface.dispatchEvent(new Event("focus"));
    input.update();
    expect(input.hit("b") || input.held("down")).toBe(false);
    // Moving the other axis should not send the old cancel into the new menu.
    pads = [pad(0, [1, 1], [1])];
    input.update();
    expect(input.hit("right")).toBe(true);
    expect(input.hit("b") || input.held("down")).toBe(false);
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
    expect(input.connectedGamepads).toEqual(pads);
  });
  it("resumes controller polling when the page returns without a focus event", () => {
    const input = new Input();
    surface.dispatchEvent(new Event("blur"));
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.connectedGamepads).toEqual([]);
    surface.dispatchEvent(new Event("pageshow"));
    input.update();
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
  });
  it("resumes controller polling when a blurred page is visible and focused again", () => {
    vi.stubGlobal("document", { visibilityState: "hidden", hasFocus: () => false });
    const input = new Input();
    surface.dispatchEvent(new Event("blur"));
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.connectedGamepads).toEqual([]);
    vi.stubGlobal("document", { visibilityState: "visible", hasFocus: () => true });
    input.update();
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
  });
  it("retries Gamepad access after the page is touched", () => {
    let blocked = true;
    vi.stubGlobal("navigator", { getGamepads: () => { if (blocked) throw new DOMException("Blocked", "SecurityError"); return pads; } });
    const input = new Input();
    input.update();
    blocked = false;
    surface.dispatchEvent(new Event("pointerdown"));
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.connectedGamepads).toEqual(pads);
  });
  it("ignores a receiver with a stuck axis and follows the controller actually used", () => {
    const input = new Input();
    pads = [pad(0, [1, 0]), pad(1)];
    input.update();
    expect(input.held("right")).toBe(false);
    pads[1] = pad(1, [0, 0], [12]);
    input.update();
    expect(input.held("up")).toBe(true);
    expect(input.held("right")).toBe(false);
    pads[1] = pad(1);
    input.update();
    expect(input.held("up")).toBe(false);
    pads[1] = pad(1, [-1, 0]);
    input.update();
    expect(input.held("left")).toBe(true);
  });
  it("ignores an idle receiver reusing a disconnected controller's slot", () => {
    const input = new Input();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
    pads = [];
    input.update();
    pads = [pad(0, [-1, 0])];
    input.update();
    expect(input.held("left")).toBe(false);
    pads = [pad(0, [1, 0])];
    input.update();
    expect(input.hit("right")).toBe(true);
    pads = [{ ...pad(0, [0, 1]), id: "Another receiver" }];
    input.update();
    expect(input.held("down")).toBe(false);
  });
  it("follows the D-pad when the stick is held across it", () => {
    const input = new Input();
    pads = [pad(0, [0, -1], [15])];
    input.update();
    expect(input.hit("right")).toBe(true);
    expect(input.held("up")).toBe(false);
    expect(heldHeading(input, "up")).toMatchObject({ dx: 1, dy: 0, facing: "right" });
    pads = [pad(0, [1, 0], [12, 14])];
    input.update();
    expect(input.hit("left")).toBe(true);
    expect(input.hit("up")).toBe(true);
    expect(input.held("right")).toBe(false);
  });
  it("walks at the exact stick angle while keeping directional actions discrete", () => {
    const input = new Input();
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0.8, -0.2])];
    input.update();
    const pos = { x: 0, y: 0 };
    const heading = heldHeading(input, "up")!;
    expect(heading).toMatchObject({ facing: "right", across: "right", along: undefined });
    expect(walkFreely(pos, heading, 1, () => false)).toBeCloseTo(1);
    expect(pos.y / pos.x).toBeCloseTo(-0.25);
    expect(input.held("right")).toBe(true);
    expect(input.held("up")).toBe(false);

    pads = [pad(0, [0.45, -0.9])];
    input.update();
    const steered = heldHeading(input, "right")!;
    expect(steered.facing).toBe("up");
    expect(steered.dx / steered.dy).toBeCloseTo(-0.5);
  });
  it("uses a radial dead zone and waits for a held stick to recenter after focus returns", () => {
    const input = new Input();
    pads = [pad(0, [0.2, 0.2])];
    input.update();
    expect(heldHeading(input, "down")).toBeUndefined();
    pads = [pad(0, [0.3, 0.3])];
    input.update();
    expect(heldHeading(input, "down")?.dx).toBeCloseTo(Math.SQRT1_2);
    expect(input.held("right") || input.held("down")).toBe(false);

    surface.dispatchEvent(new Event("blur"));
    expect(heldHeading(input, "down")).toBeUndefined();
    surface.dispatchEvent(new Event("focus"));
    input.update();
    pads = [pad(0, [0.3, 0.3], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
    expect(heldHeading(input, "down")).toBeUndefined();
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0.3, 0.3])];
    input.update();
    expect(heldHeading(input, "down")?.dx).toBeCloseTo(Math.SQRT1_2);
  });
  it("swaps gamepad A and B after releasing the button used to change layouts", () => {
    const input = new Input();
    pads = [pad(0, [0, 0], [0])];
    input.update();
    expect(input.hit("a")).toBe(true);
    input.setGamepadLayout(true);
    input.update();
    expect(input.held("b")).toBe(false);
    pads = [pad(0)];
    input.update();
    pads = [pad(0, [0, 0], [0, 9])];
    input.update();
    expect(input.hit("b") && input.hit("menu")).toBe(true);
    pads = [pad(0, [0, 0], [1])];
    input.update();
    expect(input.hit("a")).toBe(true);
    pads = [pad(0)];
    input.update();
    key("keydown", "z", "KeyZ");
    input.update();
    expect(input.hit("a")).toBe(true);
  });
  it("merges simultaneous touch movement and confirm, and releases cancelled touches", () => {
    const input = new Input();
    const a = new EventTarget() as unknown as HTMLElement;
    const up = new EventTarget() as unknown as HTMLElement;
    a.setPointerCapture = () => {};
    up.setPointerCapture = () => {};
    input.bind(a, "a");
    input.bind(up, "up");
    const send = (target: HTMLElement, type: string, pointerId: number) => {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { pointerId });
      target.dispatchEvent(event);
    };
    send(up, "pointerdown", 1);
    send(a, "pointerdown", 2);
    send(a, "pointerup", 2);
    input.update();
    expect(input.held("up")).toBe(true);
    expect(input.hit("a")).toBe(true);
    send(up, "pointercancel", 1);
    input.update();
    expect(input.held("up")).toBe(false);
  });
  it("steers through diagonals, the center and the edge with one held thumb", () => {
    const input = new Input();
    const pad = Object.assign(new EventTarget(), {
      dataset: {}, setPointerCapture() {}, hasPointerCapture: () => true,
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 144, height: 144 }),
    });
    input.bindDpad(pad as unknown as HTMLElement);
    function move(type: string, x: number, y: number) {
      pad.dispatchEvent(Object.assign(new Event(type), { pointerId: 7, clientX: x, clientY: y }));
      input.update();
      return (["up", "right", "down", "left"] as const).filter(d => input.held(d));
    }
    expect(move("pointerdown", 82, 42)).toEqual(["up"]);
    expect(move("pointermove", 137, 42)).toEqual(["up", "right"]);
    expect(move("pointermove", 137, 92)).toEqual(["right"]);
    expect(move("pointermove", 82, 92)).toEqual([]);
    expect(move("pointermove", 9, 92)).toEqual([]);
    expect(move("pointermove", 33, 92)).toEqual(["left"]);
    expect(move("lostpointercapture", 33, 92)).toEqual([]);
    expect(move("pointermove", 82, 42)).toEqual([]);
  });
});
