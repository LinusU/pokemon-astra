import type { Engine } from "../engine";
import type { CaptureSoundState } from "../engine/battle-sound";

export const MUSIC_TRACKS: Record<string, [number, number]> = {
  town: [0x3a, 0x72d3],
  route: [0x3c, 0x4386],
  cave: [0x3a, 0x62be],
  center: [0x3b, 0x55c6],
  wild: [0x3d, 0x5dc5],
  trainer: [0x3d, 0x6096],
  gym: [0x3a, 0x650d],
  champion: [0x3a, 0x69c1],
};
const MUSIC_VOLUME = 0.28;
const FANFARES: Record<"heal" | "item", readonly [pitch: number, beats: number][]> = {
  heal: [[60, 1], [64, 1], [67, 1], [72, 2], [76, 1], [79, 3]],
  item: [[72, 1], [76, 1], [79, 1], [84, 3]],
};

/** One gesture-unlocked audio context, with continuous ROM synthesis and no overlapping tracks. */
export class GameAudio {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private effectSources = new Set<AudioBufferSourceNode>();
  private buffers = new Map<string, AudioBuffer>();
  private timer?: number;
  private next = 0;
  private current = "";
  private engine?: Engine;
  enabled = true;
  failed = false;
  constructor(
    private scene: () => string,
    private changed: () => void = () => {},
  ) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopScheduled();
        this.stopEffects();
        void this.context?.suspend();
      } else if (this.enabled && this.context) {
        void this.context.resume().then(() => this.pump());
      }
    });
  }
  attach(engine: Engine, enabled = true) {
    if (this.engine !== engine) {
      this.buffers.clear();
    }
    if (this.engine !== engine || !enabled) this.stopEffects();
    this.engine = engine;
    this.enabled = enabled;
    this.current = "";
    this.changed();
  }
  get playing() {
    return this.enabled && this.context?.state === "running" && !this.failed;
  }
  async unlock() {
    if (!this.engine || !this.enabled || document.hidden) return;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContext({ latencyHint: "interactive" });
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = MUSIC_VOLUME;
        this.musicGain.connect(this.context.destination);
        this.effectsGain = this.context.createGain();
        this.effectsGain.gain.value = 0.55;
        this.effectsGain.connect(this.context.destination);
      }
      await this.context.resume();
      this.failed = false;
      this.pump();
    } catch (error) {
      this.failed = true;
      console.warn("Astra audio could not start", error);
    }
    this.changed();
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) void this.unlock();
    else {
      this.stopScheduled();
      this.stopEffects();
      if (this.context) void this.context.suspend();
    }
    this.changed();
  }
  private stopScheduled() {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.next = this.context?.currentTime ?? 0;
  }
  private pump = () => {
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
    const ctx = this.context;
    if (
      !this.enabled ||
      !this.engine ||
      !ctx ||
      ctx.state !== "running" ||
      document.hidden
    )
      return;
    try {
      const scene = this.scene();
      if (scene !== this.current) {
        this.stopScheduled();
        this.engine.startMusic(...(MUSIC_TRACKS[scene] || MUSIC_TRACKS.town));
        this.current = scene;
        this.next = ctx.currentTime + 0.025;
      }
      // Never attempt to catch up by scheduling audio in the past after a slow frame.
      this.next = Math.max(this.next, ctx.currentTime + 0.012);
      while (this.next < ctx.currentTime + 0.55) {
        const data = this.engine.nextMusicChunk(12000);
        if (!data.length)
          throw Error("The cartridge music stream ended unexpectedly");
        const buffer = ctx.createBuffer(1, data.length, 48000);
        buffer.copyToChannel(new Float32Array(data), 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.musicGain!);
        source.onended = () => this.sources.delete(source);
        this.sources.add(source);
        source.start(this.next);
        this.next += buffer.duration;
      }
      this.timer = window.setTimeout(this.pump, 120);
    } catch (error) {
      this.failed = true;
      this.stopScheduled();
      console.warn("Astra music stopped", error);
      this.changed();
    }
  };
  private stopEffects() {
    for (const source of this.effectSources) source.stop();
    this.effectSources.clear();
  }

  private get canPlayEffects() {
    return this.enabled && this.context?.state === "running" && !document.hidden;
  }

  private buffer(key: string, decode: () => Float32Array) {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    try {
      const data = decode();
      if (!data.length) return;
      const buffer = this.context!.createBuffer(1, data.length, 47662);
      buffer.copyToChannel(new Float32Array(data), 0);
      if (this.buffers.size >= 64) this.buffers.delete(this.buffers.keys().next().value!);
      this.buffers.set(key, buffer);
      return buffer;
    } catch (error) {
      console.warn("Astra cartridge sound could not play", key, error);
    }
  }

  private playEffect(buffer: AudioBuffer, when: number, pan = 0, duration = buffer.duration) {
    if (duration <= 0) return;
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const panner = pan ? context.createStereoPanner() : undefined;
    if (panner) {
      panner.pan.value = pan;
      source.connect(panner).connect(this.effectsGain!);
    } else source.connect(this.effectsGain!);
    source.onended = () => {
      this.effectSources.delete(source);
      source.disconnect();
      panner?.disconnect();
    };
    this.effectSources.add(source);
    source.start(when, 0, duration);
  }

  cry(species: number) {
    if (!this.canPlayEffects || !this.engine) return;
    const pcm = this.buffer(`cry:${species}:0`, () => this.engine!.cry(species));
    if (pcm) this.playEffect(pcm, this.context!.currentTime);
  }

  soundEffect(id: number) {
    if (!this.canPlayEffects || !this.engine) return;
    const pcm = this.buffer(`sfx:${id}`, () => this.engine!.soundEffect(id));
    if (pcm) this.playEffect(pcm, this.context!.currentTime);
  }

  battleAnimation(
    id: number,
    param: number,
    species: number,
    enemy: boolean,
    duration: number,
    capture?: CaptureSoundState,
  ) {
    const engine = this.engine;
    if (!this.canPlayEffects || !engine) return;
    const timeline = engine.battleSound(id, param, capture);
    if (!timeline?.cues.length) return;
    const side = enemy ? 1 : -1;
    const cues = timeline.cues.map((cue) => ({
      frame: cue.frame,
      pan: side * (cue.kind === "effect" && (cue.track & 1) ? -0.55 : 0.55),
      buffer: cue.kind === "effect"
        ? this.buffer(`sfx:${cue.id}`, () => engine.soundEffect(cue.id))
        : this.buffer(`cry:${species}:${cue.lengthOffset}`, () => engine.cry(species, cue.lengthOffset)),
    }));
    const start = this.context!.currentTime + 0.008;
    const secondsPerFrame = duration / (1000 * timeline.frames);
    for (const [index, cue] of cues.entries()) {
      if (!cue.buffer) continue;
      const next = cues[index + 1];
      // Replaying the same effect retriggers its cartridge channels.
      const duration = next?.buffer === cue.buffer
        ? Math.min(cue.buffer.duration, (next.frame - cue.frame) * secondsPerFrame)
        : cue.buffer.duration;
      this.playEffect(cue.buffer, start + cue.frame * secondsPerFrame, cue.pan, duration);
    }
  }
  fanfare(kind: keyof typeof FANFARES) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const start = ctx.currentTime;
    let time = start + 0.02;
    for (const [pitch, beats] of FANFARES[kind]) {
      const note = ctx.createOscillator();
      const envelope = ctx.createGain();
      const end = time + 0.11 * beats;
      note.type = "square";
      note.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
      envelope.gain.setValueAtTime(0.001, time);
      envelope.gain.linearRampToValueAtTime(0.22, time + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, end - 0.015);
      note.connect(envelope).connect(this.effectsGain!);
      note.start(time);
      note.stop(end);
      time = end;
    }
    const music = this.musicGain!.gain;
    music.cancelScheduledValues(start);
    music.setValueAtTime(music.value, start);
    music.linearRampToValueAtTime(0.035, start + 0.02);
    music.setValueAtTime(0.035, time);
    music.linearRampToValueAtTime(MUSIC_VOLUME, time + 0.12);
  }
  cue(kind: "notice" | "step" | "confirm") {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = kind === "step" ? "triangle" : "square";
    const time = ctx.currentTime,
      duration = kind === "notice" ? 0.22 : 0.06;
    oscillator.frequency.setValueAtTime(
      kind === "notice"
        ? 740
        : kind === "step"
            ? 140
            : 880,
      time,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === "notice" ? 1108 : 300,
      time + duration,
    );
    gain.gain.setValueAtTime(kind === "step" ? 0.018 : 0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(this.effectsGain!);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
}
