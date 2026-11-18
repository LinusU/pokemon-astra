import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameAudio } from "../src/game/audio";
import type { Engine } from "../src/engine";
let context: FakeContext;
class FakeNode {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  frequency = { value: 0 };
  pan = { value: 0 };
  buffer: any;
  connect() {
    return this;
  }
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  state = "suspended";
  currentTime = 0;
  destination = new FakeNode();
  sources: FakeNode[] = [];
  oscillators: FakeNode[] = [];
  panners: FakeNode[] = [];
  constructor() {
    context = this;
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  createGain() {
    return new FakeNode();
  }
  createBufferSource() {
    const source = new FakeNode();
    this.sources.push(source);
    return source;
  }
  createOscillator() {
    const oscillator = new FakeNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createStereoPanner() {
    const node = new FakeNode();
    this.panners.push(node);
    return node;
  }
  createBuffer(_channels: number, count: number, rate: number) {
    return { duration: count / rate, copyToChannel() {} };
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.stubGlobal("AudioContext", FakeContext);
});
it("schedules distinct healing and item fanfares and honors mute", async () => {
  const audio = new GameAudio(() => "town");
  audio.attach({
    startMusic() {},
    nextMusicChunk: () => new Float32Array(12000),
  } as unknown as Engine);
  await audio.unlock();
  audio.fanfare("item");
  const item = context.oscillators.slice();
  audio.fanfare("heal");
  const heal = context.oscillators.slice(item.length);
  expect(item.length).toBeGreaterThan(1);
  expect(heal.map((note) => note.frequency.value)).not.toEqual(item.map((note) => note.frequency.value));
  expect(item[1].start.mock.calls[0][0]).toBeGreaterThan(item[0].start.mock.calls[0][0]);
  audio.setEnabled(false);
  audio.fanfare("heal");
  expect(context.oscillators).toHaveLength(item.length + heal.length);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("starts music after a gesture with sound enabled by default", async () => {
  const engine = {
    startMusic: vi.fn(),
    nextMusicChunk: vi.fn(() => new Float32Array(12000)),
  };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine);
  expect(audio.playing).toBe(false);
  await audio.unlock();
  expect(context.resume).toHaveBeenCalled();
  expect(audio.playing).toBe(true);
  expect(engine.startMusic).toHaveBeenCalledTimes(1);
  expect(context.sources.length).toBe(3);
  context.currentTime = 0.5;
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.startMusic).toHaveBeenCalledTimes(1);
  expect(context.sources.length).toBeGreaterThan(3);
});
it("stops queued town audio when a battle track begins", async () => {
  let scene = "town";
  const engine = {
    startMusic: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
  };
  const audio = new GameAudio(() => scene);
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  const old = [...context.sources];
  scene = "wild";
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.startMusic).toHaveBeenCalledTimes(2);
  expect(old.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
});
it("schedules cartridge sounds on the animation clock and retriggers repeated sounds", async () => {
  const soundEffect = vi.fn(() => new Float32Array(24000));
  const cry = vi.fn(() => new Float32Array(24000));
  const audio = new GameAudio(() => "wild");
  audio.attach({
    startMusic() {},
    nextMusicChunk: () => new Float32Array(12000),
    soundEffect, cry,
    battleSound: () => ({
      frames: 40,
      cues: [
        { kind: "effect", id: 69, frame: 5, track: 0 },
        { kind: "effect", id: 69, frame: 15, track: 1 },
        { kind: "cry", frame: 20, lengthOffset: 192 },
      ],
    }),
  } as unknown as Engine);
  await audio.unlock();
  const before = context.sources.length;
  audio.battleAnimation(44, 0, 25, false, 400);
  const effects = context.sources.slice(before);
  expect(soundEffect).toHaveBeenCalledTimes(1);
  expect(cry).toHaveBeenCalledWith(25, 192);
  expect(context.panners.map((node) => node.pan.value)).toEqual([-0.55, 0.55, -0.55]);
  expect(effects[0].start.mock.calls[0][0]).toBeCloseTo(0.058);
  expect(effects[0].start.mock.calls[0][2]).toBeCloseTo(0.1);
  expect(effects[1].start.mock.calls[0][0]).toBeCloseTo(0.158);
  audio.setEnabled(false);
  expect(effects.every((effect) => effect.stop.mock.calls.length === 1)).toBe(true);
  audio.battleAnimation(44, 0, 25, false, 400);
  expect(context.sources.slice(before)).toHaveLength(3);
});
it("honors saved mute and resumes explicitly without creating more audio contexts", async () => {
  const engine = {
    startMusic: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
  };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine, false);
  await audio.unlock();
  expect(engine.startMusic).not.toHaveBeenCalled();
  audio.setEnabled(true);
  await Promise.resolve();
  expect(audio.playing).toBe(true);
  const original = context;
  audio.setEnabled(false);
  expect(audio.playing).toBe(false);
  audio.setEnabled(true);
  await Promise.resolve();
  expect(context).toBe(original);
});
