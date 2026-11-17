import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameAudio } from "../src/game/audio";
import type { Engine } from "../src/engine";
let context: FakeContext;
class FakeNode {
  gain = { value: 0 };
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
