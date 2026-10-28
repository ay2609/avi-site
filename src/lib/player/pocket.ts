import type { Playing, Screen } from "@/lib/teardown/device";

import playlist from "./playlist.json";

/**
 * The player's last chapter, working: a playlist (src/lib/player/playlist.json,
 * from a public Spotify playlist by scripts/spotify-playlist.py) on the 64 × 64
 * OLED and the three buttons.
 *
 * The screen is what the device is meant to show — the album cover, at the
 * panel's resolution (Spotify serves a 64 × 64 size) — with a progress line
 * along the foot and a play or pause mark while it isn't playing. The sound is
 * each track's 30-second preview, streamed from Spotify and played through a
 * small chain that makes it sound like a tiny player into cheap earbuds: the
 * lows and the top end rolled off, a little saturation, a little squash.
 */

export const PX = 64;

interface Track {
  title: string;
  artist: string;
  url: string;
  preview: string;
  cover: string;
  art: string;
}

const TRACKS = playlist.tracks as Track[];

/** ABGR, as a little-endian Uint32 view writes RGBA bytes. */
const abgr = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const BLACK = abgr(0, 0, 0);
const WHITE = abgr(250, 250, 250);
const TRACK = abgr(60, 60, 60);

/** Prev within this many seconds of a track's start goes to the one before; later, back to its start. */
const RESTART_S = 3;

/** 5 × 5 marks, drawn in a black square in the top-left corner. */
const PLAY_MARK = ["10000", "11000", "11100", "11000", "10000"];
const PAUSE_MARK = ["11011", "11011", "11011", "11011", "11011"];

export class PocketPlayer implements Screen {
  readonly width = PX;
  readonly height = PX;
  readonly bytes = new Uint8Array(PX * PX * 4);
  private readonly px = new Uint32Array(this.bytes.buffer);

  private index = 0;
  private playing = false;
  private started = false;
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private readonly covers = new Map<number, Uint32Array | null>();
  private dirty = true;
  private lastSecond = -1;
  private lastBar = -1;
  private readonly listeners = new Set<() => void>();

  // --- Screen ----------------------------------------------------------------

  reset(): void {
    this.load(this.index);
    this.dirty = true;
  }

  step(): boolean {
    const a = this.audio;
    if (a && this.playing) {
      const bar = Math.round(this.progress() * PX);
      if (bar !== this.lastBar) this.dirty = true;
      const second = Math.floor(a.currentTime);
      if (second !== this.lastSecond) {
        this.lastSecond = second;
        this.emit();
      }
    }
    if (!this.dirty) return false;
    this.dirty = false;
    this.draw();
    return true;
  }

  /** The chapter is leaving (or the article closing): stop the sound. */
  sleep(): void {
    if (this.playing) this.pause();
  }

  press(button: string): void {
    if (!TRACKS.length) return;
    if (button === "play") {
      if (this.playing) this.pause();
      else this.play();
    } else if (button === "next") this.go(this.index + 1, this.playing);
    else if (button === "prev") {
      if (this.audio && this.audio.currentTime > RESTART_S) {
        this.audio.currentTime = 0;
        this.dirty = true;
        this.emit();
      } else this.go(this.index - 1, this.playing);
    }
  }

  status(): Playing | null {
    const t = TRACKS[this.index];
    if (!t) return null;
    return {
      index: this.index,
      count: TRACKS.length,
      title: t.title,
      artist: t.artist,
      url: t.url,
      playing: this.playing,
      elapsed: this.audio?.currentTime ?? 0,
      duration: this.audio && Number.isFinite(this.audio.duration) ? this.audio.duration : 30,
      source: { name: playlist.name, url: playlist.url },
    };
  }

  subscribe(f: () => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  // --- Playback ----------------------------------------------------------------

  private play(): void {
    const audio = this.ensureAudio();
    if (!this.started || !audio.src) this.cue(this.index);
    void this.ctx?.resume();
    audio.play().then(
      () => {
        this.playing = true;
        this.started = true;
        this.dirty = true;
        this.emit();
      },
      () => {
        this.playing = false;
        this.emit();
      }
    );
  }

  private pause(): void {
    this.audio?.pause();
    this.playing = false;
    this.dirty = true;
    this.emit();
  }

  private go(index: number, keepPlaying: boolean): void {
    this.index = (index + TRACKS.length) % TRACKS.length;
    this.load(this.index);
    this.load((this.index + 1) % TRACKS.length);
    if (this.audio) this.cue(this.index);
    this.dirty = true;
    if (keepPlaying) this.play();
    else this.emit();
  }

  private cue(index: number): void {
    const audio = this.ensureAudio();
    audio.src = TRACKS[index].preview;
    audio.currentTime = 0;
    this.lastBar = -1;
  }

  /**
   * The element and the earbud chain, made on the first press (browsers only
   * let sound start from a gesture): high-pass 150 Hz, low-pass 7 kHz, a soft
   * tanh curve, then a gentle compressor.
   */
  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.crossOrigin = "anonymous"; // Spotify's preview CDN allows it, so Web Audio can process the stream
    audio.preload = "auto";
    audio.addEventListener("ended", () => this.go(this.index + 1, true));
    this.audio = audio;
    // iOS mutes Web Audio under the silent switch unless the page says it's playing media.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const low = ctx.createBiquadFilter();
      low.type = "highpass";
      low.frequency.value = 150;
      const high = ctx.createBiquadFilter();
      high.type = "lowpass";
      high.frequency.value = 7000;
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6);
      }
      shaper.curve = curve;
      const squash = ctx.createDynamicsCompressor();
      squash.threshold.value = -20;
      squash.ratio.value = 3;
      const level = ctx.createGain();
      level.gain.value = 0.7;
      source.connect(low).connect(high).connect(shaper).connect(squash).connect(level).connect(ctx.destination);
      this.ctx = ctx;
    } catch {
      // No Web Audio: the element plays on its own, clean.
    }
    return audio;
  }

  private progress(): number {
    const a = this.audio;
    if (!a || !Number.isFinite(a.duration) || a.duration <= 0) return 0;
    return Math.min(1, a.currentTime / a.duration);
  }

  private emit(): void {
    this.listeners.forEach((f) => f());
  }

  // --- The panel -----------------------------------------------------------------

  /** A track's cover, scaled to the panel. */
  private load(index: number): void {
    if (this.covers.has(index) || typeof Image === "undefined") return;
    this.covers.set(index, null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PX;
      const g = canvas.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, PX, PX);
      const data = g.getImageData(0, 0, PX, PX).data;
      this.covers.set(index, new Uint32Array(data.buffer.slice(0)));
      if (index === this.index) this.dirty = true;
    };
    img.src = TRACKS[index].cover;
  }

  private draw(): void {
    const px = this.px;
    const cover = this.covers.get(this.index);
    if (cover) px.set(cover);
    else px.fill(BLACK);

    // Progress along the foot: a black row to sit it off the art, then the line.
    const bar = Math.round(this.progress() * PX);
    this.lastBar = bar;
    for (let x = 0; x < PX; x++) {
      px[(PX - 2) * PX + x] = BLACK;
      px[(PX - 1) * PX + x] = x < bar ? WHITE : TRACK;
    }

    if (!this.playing) {
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) px[y * PX + x] = BLACK;
      const mark = this.started ? PAUSE_MARK : PLAY_MARK;
      mark.forEach((row, y) => {
        for (let x = 0; x < 5; x++) if (row[x] === "1") px[(y + 2) * PX + x + 2] = WHITE;
      });
    }
  }
}
