import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameAudio, HEAL_TRACK, isSoundSetting, soundMode, soundSetting } from "../src/game/audio";
import { MUSIC_TRACKS, battleTheme, fieldMusic, trainerIntroMusic, victoryTheme, type MusicScene } from "../src/game/music";
import { WORLD } from "../src/world";
import type { Engine } from "../src/engine";
let context: FakeContext;
class FakeNode {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
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
    startMusicTrack() {},
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
  audio.setMode("off");
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
it("ducks music for reward jingles through a victory music change", async () => {
  let scene: MusicScene = "gymBattle";
  const audio = new GameAudio(() => scene);
  audio.attach({
    startMusicTrack() {},
    nextMusicChunk: () => new Float32Array(12000),
    soundEffect: (id: number) => new Float32Array(id === 0x01 ? 47662 : 23831),
  } as unknown as Engine);
  await audio.unlock();
  const gain = context.gains[1].gain;
  audio.overworld("door");
  expect(gain.setTargetAtTime).not.toHaveBeenCalled();

  audio.overworld("item");
  expect(context.sources.at(-1)!.start).toHaveBeenCalledWith(0.02, 0, 1);
  expect(gain.setTargetAtTime.mock.calls).toEqual([[0.2, 0, 0.005], [1, 1.02, 0.03]]);

  context.currentTime = 0.25;
  scene = "gymVictory";
  audio.refreshMusic();
  audio.soundEffect(0xb6);
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1.02, 0.03);

  context.currentTime = 0.75;
  audio.overworld("badge");
  expect(gain.cancelScheduledValues).toHaveBeenLastCalledWith(0.75);
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1.27, 0.03);

  audio.setMode("off");
  expect(gain.setValueAtTime).toHaveBeenLastCalledWith(1, 0.75);
});
it("starts music after a gesture with sound enabled by default", async () => {
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: vi.fn(() => new Float32Array(12000)),
  };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine);
  expect(audio.playing).toBe(false);
  await audio.unlock();
  expect(context.resume).toHaveBeenCalled();
  expect(audio.playing).toBe(true);
  expect(engine.startMusicTrack).toHaveBeenCalledTimes(1);
  expect(context.sources.length).toBe(3);
  context.currentTime = 0.5;
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.startMusicTrack).toHaveBeenCalledTimes(1);
  expect(context.sources.length).toBeGreaterThan(3);
});
it("stops queued town audio when a battle track begins", async () => {
  let scene: MusicScene = "town";
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
  };
  const audio = new GameAudio(() => scene);
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  const old = [...context.sources];
  scene = "wild";
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.startMusicTrack).toHaveBeenCalledTimes(2);
  expect(old.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
});
it("switches between the encounter, battle, victory, evolution and map tracks", async () => {
  let scene: MusicScene = "route";
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
  };
  const audio = new GameAudio(() => scene);
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  const tracks = ["rivalIntro", "rivalBattle", "trainerVictory", "evolution", "silent", "route"] as const;
  for (const phase of tracks) {
    const previous = context.sources.filter((source) => !source.stop.mock.calls.length);
    scene = phase;
    audio.refreshMusic();
    expect(previous.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  }
  expect(engine.startMusicTrack.mock.calls.flat()).toEqual(
    ["route", ...tracks].filter((phase) => phase !== "silent").map((phase) => MUSIC_TRACKS[phase as MusicScene]),
  );
});
it("finishes a finite song and picks up the next scene without an audio error", async () => {
  let scene: MusicScene = "capture";
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: vi.fn(() => new Float32Array(12000))
      .mockReturnValueOnce(new Float32Array(1000))
      .mockReturnValueOnce(new Float32Array()),
  };
  const audio = new GameAudio(() => scene);
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  expect(audio.playing).toBe(true);
  expect(engine.nextMusicChunk).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.nextMusicChunk).toHaveBeenCalledTimes(2);
  scene = "town";
  await vi.advanceTimersByTimeAsync(120);
  expect(engine.startMusicTrack).toHaveBeenLastCalledWith(MUSIC_TRACKS.town);
  expect(audio.playing).toBe(true);
});
it("uses distinct scoring for trainer roles and night encounters", () => {
  const trainer = {
    id: "rematch_rival_1", kind: "trainer" as const, name: "Robin",
    trainer: { id: "rival_1", name: "Robin", team: [] },
  };
  expect(trainerIntroMusic(trainer)).toBe("rivalIntro");
  expect(battleTheme(trainer, true)).toBe("rivalBattle");
  expect(victoryTheme(trainer)).toBe("trainerVictory");
  const gym = { ...trainer, id: "leader_1", kind: "leader" as const, trainer: { ...trainer.trainer, id: "leader_1" } };
  expect(battleTheme(gym, false)).toBe("gymBattle");
  expect(victoryTheme(gym)).toBe("gymVictory");
  expect(battleTheme(undefined, true)).toBe("wildNight");
  expect(victoryTheme()).toBe("wildVictory");
});
it("schedules cartridge sounds on the animation clock and retriggers repeated sounds", async () => {
  const soundEffect = vi.fn(() => new Float32Array(24000));
  const cry = vi.fn(() => new Float32Array(24000));
  const audio = new GameAudio(() => "wild");
  audio.attach({
    startMusicTrack() {},
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
  audio.setMode("off");
  expect(effects.every((effect) => effect.stop.mock.calls.length === 1)).toBe(true);
  audio.battleAnimation(44, 0, 25, false, 400);
  expect(context.sources.slice(before)).toHaveLength(3);
});
it("honors saved mute and resumes explicitly without creating more audio contexts", async () => {
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
  };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine, false);
  await audio.unlock();
  expect(engine.startMusicTrack).not.toHaveBeenCalled();
  audio.setMode("on");
  await Promise.resolve();
  expect(audio.playing).toBe(true);
  const original = context;
  audio.setMode("off");
  expect(audio.playing).toBe(false);
  audio.setMode("on");
  await Promise.resolve();
  expect(context).toBe(original);
});

it("plays sound effects without music in effects-only mode", async () => {
  const engine = {
    startMusicTrack: vi.fn(),
    nextMusicChunk: () => new Float32Array(12000),
    soundEffect: vi.fn(() => new Float32Array(2400)),
  };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine, "effects");
  await audio.unlock();
  expect(audio.playing).toBe(true);
  expect(engine.startMusicTrack).not.toHaveBeenCalled();
  audio.soundEffect(1);
  expect(context.sources.length).toBe(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(engine.startMusicTrack).not.toHaveBeenCalled();
});

it("cycles sound on, effects only and off, stopping music for effects", async () => {
  const engine = { startMusicTrack: vi.fn(), nextMusicChunk: () => new Float32Array(12000) };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  const scheduled = [...context.sources];
  expect(audio.cycleMode()).toBe("effects");
  expect(scheduled.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  expect(audio.enabled).toBe(true);
  expect(audio.music).toBe(false);
  expect(audio.cycleMode()).toBe("off");
  expect(context.state).toBe("suspended");
  expect(audio.cycleMode()).toBe("on");
  await Promise.resolve();
  expect(engine.startMusicTrack).toHaveBeenCalledTimes(2);
});

it("reads older on/off saves and stores effects-only as its own setting", () => {
  expect(soundMode(undefined)).toBe("on");
  expect(soundMode(true)).toBe("on");
  expect(soundMode(false)).toBe("off");
  expect(soundMode("effects")).toBe("effects");
  expect(soundSetting("effects")).toBe("effects");
  expect(soundSetting("on")).toBe(true);
  expect(soundSetting("off")).toBe(false);
  expect(isSoundSetting("effects")).toBe(true);
  expect(isSoundSetting("music")).toBe(false);
});

it("silences queued music immediately when restoring a muted journey", async () => {
  const engine = { startMusicTrack: vi.fn(), nextMusicChunk: () => new Float32Array(12000) };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  await audio.unlock();
  expect(context.resume).toHaveBeenCalledTimes(1);
  const scheduled = [...context.sources];
  audio.attach(engine as unknown as Engine, false);
  expect(scheduled.length).toBeGreaterThan(0);
  expect(scheduled.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  expect(context.state).toBe("suspended");
});

it("can retry after an interrupted browser refuses to resume audio", async () => {
  const engine = { startMusicTrack: vi.fn(), nextMusicChunk: () => new Float32Array(12000) };
  const audio = new GameAudio(() => "town");
  audio.attach(engine as unknown as Engine);
  await audio.unlock();
  Object.assign(document, { hidden: true });
  document.dispatchEvent(new Event("visibilitychange"));
  context.resume.mockRejectedValueOnce(new Error("Audio interrupted"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    Object.assign(document, { hidden: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(audio.failed).toBe(true);
    await audio.unlock();
    expect(audio.playing).toBe(true);
  } finally {
    warn.mockRestore();
  }
});

it("keeps each town's theme through its shop and each expedition's theme through its rooms", () => {
  const towns = Object.values(WORLD).filter(map => map.kind === "town");
  expect(new Set(towns.map(fieldMusic)).size).toBe(towns.length);
  for (const town of towns) {
    expect(fieldMusic(WORLD[town.id + "_mart"])).toBe(fieldMusic(town));
    expect(fieldMusic(WORLD[town.id + "_center"])).toBe("center");
  }
  for (const room of Object.values(WORLD).filter(map => map.kind === "dungeon"))
    expect(fieldMusic(room)).toBe(fieldMusic(WORLD[room.id.split("_")[0] + "_1"]));
});
