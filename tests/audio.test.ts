import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameAudio, HEAL_TRACK } from "../src/game/audio";
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
  gains: FakeNode[] = [];
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
    const node = new FakeNode();
    this.gains.push(node);
    return node;
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
    return { duration: count / rate, sampleRate: rate, copyToChannel() {} };
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
it("plays the cartridge heal tune and restores the map music at the end", async () => {
  const music = vi.fn(() => new Float32Array([0, 0.2, -0.1, 0, 0]));
  const soundEffect = vi.fn(() => new Float32Array(2400));
  const audio = new GameAudio(() => "center");
  audio.attach({
    startMusic() {},
    nextMusicChunk: () => new Float32Array(12000),
    music, soundEffect,
  } as unknown as Engine);
  await audio.unlock();
  audio.overworld("item");
  audio.overworld("purchase");
  expect(soundEffect.mock.calls).toEqual([[0x01], [0x22]]);
  audio.heal();
  expect(music).toHaveBeenCalledWith(...HEAL_TRACK);
  const heal = context.sources.at(-1)!;
  expect(heal.buffer.duration).toBe(3 / 48000);
  expect(heal.buffer.sampleRate).toBe(48000);
  const gain = context.gains[0].gain;
  expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.02);
  expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.28, 0.02 + heal.buffer.duration + 0.12);
  expect(context.oscillators).toHaveLength(0);
  audio.setEnabled(false);
  expect(heal.stop).toHaveBeenCalled();
  expect(gain.setValueAtTime).toHaveBeenLastCalledWith(0.28, 0);
  audio.heal();
  audio.overworld("door");
  expect(music).toHaveBeenCalledTimes(1);
  expect(soundEffect).toHaveBeenCalledTimes(2);
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
