import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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
    pads = [pad(0, [1, 0], [12, 14])];
    input.update();
    expect(input.hit("left")).toBe(true);
    expect(input.hit("up")).toBe(true);
    expect(input.held("right")).toBe(false);
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
