import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../src/game/input";

let surface: EventTarget;
let pads: Gamepad[];
function key(type: string, key: string, code = key) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { key, code });
  surface.dispatchEvent(event);
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
});
