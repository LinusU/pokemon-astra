import type { Engine } from "../engine";
import type { CaptureSoundState } from "../engine/battle-sound";
import { MUSIC_TRACKS, type MusicScene } from "./music";
const MUSIC_VOLUME = 0.28;
const MUSIC_RATE = 48000;
const JINGLE_LEAD_IN = 0.02;
const JINGLE_MUSIC_GAIN = 0.2;
// Crystal 1.1's MUSIC_HEAL, used by HealMachineAnim.
export const HEAL_TRACK = [0x3c, 0x4697] as const;
// Crystal's sfx_constants.asm, for the corresponding field actions and rewards.
export const OVERWORLD_SOUNDS = {
  item: 0x01,
  potion: 0x04,
  restorePp: 0x05,
  interact: 0x08,
  fly: 0x18,
  strength: 0x1b,
  door: 0x1f,
  purchase: 0x22,
  exit: 0x23,
  bump: 0x24,
  surf: 0x53,
  badge: 0x9c,
  evolved: 0xa4,
  flash: 0xa9,
} as const;

// Melodic rewards played as SFX over the current music scene.
const JINGLE_SOUNDS = new Set<number>([
  OVERWORLD_SOUNDS.item,
  OVERWORLD_SOUNDS.badge,
  OVERWORLD_SOUNDS.evolved,
  0x02, // Caught Pokémon
  0x2d, 0x92, // Fanfares
  0x90, 0xb6, // Level up and EXP bar completion
  0x91, 0x96, 0x9b, // Key item, Egg and TM
]);

/** One gesture-unlocked audio context, with continuous ROM synthesis and no overlapping tracks. */
export class GameAudio {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private musicDuckGain?: GainNode;
  private jingleEnd = 0;
  private effectsGain?: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private effectSources = new Set<AudioBufferSourceNode>();
  private healingCue?: AudioBufferSourceNode;
  private buffers = new Map<string, AudioBuffer>();
  private timer?: number;
  private next = 0;
  private current?: MusicScene;
  private trackEnded = false;
  private engine?: Engine;
  enabled = true;
  failed = false;
  constructor(
    private scene: () => MusicScene,
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
    this.current = undefined;
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
        this.musicDuckGain = this.context.createGain();
        this.musicGain.connect(this.musicDuckGain).connect(this.context.destination);
        this.jingleEnd = 0;
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
  refreshMusic() {
    this.pump();
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
        this.trackEnded = scene === "silent";
        if (!this.trackEnded) this.engine.startMusicTrack(MUSIC_TRACKS[scene]);
        this.current = scene;
        this.next = ctx.currentTime + 0.025;
      }
      // Never attempt to catch up by scheduling audio in the past after a slow frame.
      this.next = Math.max(this.next, ctx.currentTime + 0.012);
      while (!this.trackEnded && this.next < ctx.currentTime + 0.55) {
        const data = this.engine.nextMusicChunk(12000);
        if (!data.length) {
          this.trackEnded = true;
          break;
        }
        const buffer = ctx.createBuffer(1, data.length, MUSIC_RATE);
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
    this.healingCue = undefined;
    this.jingleEnd = 0;
    if (this.context && this.musicGain && this.musicDuckGain) {
      const { currentTime } = this.context;
      this.musicGain.gain.cancelScheduledValues(currentTime);
      this.musicGain.gain.setValueAtTime(MUSIC_VOLUME, currentTime);
      this.musicDuckGain.gain.cancelScheduledValues(currentTime);
      this.musicDuckGain.gain.setValueAtTime(1, currentTime);
    }
  }

  private get canPlayEffects() {
    return this.enabled && this.context?.state === "running" && !document.hidden;
  }

  private buffer(key: string, decode: () => Float32Array, rate = 47662) {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    try {
      const data = decode();
      if (!data.length) return;
      const buffer = this.context!.createBuffer(1, data.length, rate);
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
    return source;
  }

  cry(species: number) {
    if (!this.canPlayEffects || !this.engine) return;
    const pcm = this.buffer(`cry:${species}:0`, () => this.engine!.cry(species));
    if (pcm) this.playEffect(pcm, this.context!.currentTime);
  }

  soundEffect(id: number) {
    if (!this.canPlayEffects || !this.engine) return;
    const pcm = this.buffer(`sfx:${id}`, () => this.engine!.soundEffect(id));
    if (!pcm) return;
    const now = this.context!.currentTime;
    if (!JINGLE_SOUNDS.has(id)) {
      this.playEffect(pcm, now);
      return;
    }
    const start = now + JINGLE_LEAD_IN;
    this.playEffect(pcm, start);
    this.jingleEnd = Math.max(this.jingleEnd, start + pcm.duration);
    const gain = this.musicDuckGain!.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(JINGLE_MUSIC_GAIN, now, 0.005);
    gain.setTargetAtTime(1, this.jingleEnd, 0.03);
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
  overworld(kind: keyof typeof OVERWORLD_SOUNDS) {
    this.soundEffect(OVERWORLD_SOUNDS[kind]);
  }

  bell(pitch: number) {
    if (!this.canPlayEffects) return;
    const hz = [262, 392, 523][pitch];
    const pcm = this.buffer("bell:" + pitch, () => Float32Array.from({ length: 14400 }, (_, i) => {
      const t = i / 24000;
      return (Math.sin(t * hz * Math.PI * 2) + 0.3 * Math.sin(t * hz * Math.PI * 5)) * Math.exp(-7 * t) * 0.32;
    }), 24000);
    if (pcm) this.playEffect(pcm, this.context!.currentTime);
  }

  heal() {
    const engine = this.engine;
    if (!engine || !this.canPlayEffects) return;
    const buffer = this.buffer("music:heal", () => {
      const samples = engine.music(...HEAL_TRACK);
      // The music renderer pads finished songs with silence. Restore the map
      // theme promptly at the end of this finite tune.
      let end = samples.length;
      while (end > 0 && samples[end - 1] === 0) end--;
      return samples.subarray(0, end);
    }, MUSIC_RATE);
    if (!buffer) return;
    const start = this.context!.currentTime;
    const time = start + 0.02;
    if (this.healingCue && this.effectSources.has(this.healingCue))
      this.healingCue.stop();
    this.healingCue = this.playEffect(buffer, time);
    const music = this.musicGain!.gain;
    music.cancelScheduledValues(start);
    music.setValueAtTime(music.value, start);
    music.linearRampToValueAtTime(0, time);
    music.setValueAtTime(0, time + buffer.duration);
    music.linearRampToValueAtTime(MUSIC_VOLUME, time + buffer.duration + 0.12);
  }
}
