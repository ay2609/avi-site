/**
 * The page's sound. Every sound is synthesized here with Web Audio — no
 * samples — after fundomo.com's idea that each thing you touch answers back.
 *
 * Off until the reader turns it on (the masthead's SOUND switch); the choice
 * is remembered. A browser only lets audio start inside a gesture, so a
 * remembered "on" waits for the first press or key.
 *
 * The voices, quiet and short:
 *   ping     hovering an article: a note each, from one pentatonic scale, so
 *            crossing the page plays a phrase
 *   tap      hovering a link or a button: a short, dark tap, modelled on the
 *            hover of fundomo's company list (measured, not sampled), each
 *            one cutting off the last
 *   press    pressing anything
 *   detent   a walkthrough stepping a chapter, like a rotary switch
 *   sweep    an article flying open or folding home
 *   chatter  the stage's labels typing in
 *   clock    the masthead clock, ticking while hovered
 *   drone    the globe's bend, sounding only while it moves
 *   lights   the theme flipping: a relay, then a tube flickering on (or a whine down)
 *
 * Signal path: voices → bus → dry + a short tape echo → compressor → master
 * → analyser (the switch's meter) → speakers. Taps skip the echo.
 */

const KEY = "avi-site:sound";

type Sub = () => void;

/** A minor pentatonic, A2 up: the notes the page is tuned to. */
const SCALE = [0, 3, 5, 7, 10];
export function note(step: number, base = 110): number {
  const octave = Math.floor(step / SCALE.length);
  const degree = SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length];
  return base * Math.pow(2, octave + degree / 12);
}

class Sfx {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  /** Straight to the compressor, past the echo. */
  private dry!: GainNode;
  /** The tap sounding now, cut off when the next one starts. */
  private lastTap: GainNode | null = null;
  private master!: GainNode;
  private analyserNode!: AnalyserNode;
  private noise!: AudioBuffer;

  private on = false;
  private subs = new Set<Sub>();
  private waiting = false;

  // Held voices
  private clockTimer: ReturnType<typeof setTimeout> | null = null;
  private clockAlt = false;
  private drone: { a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private droneLast: { v: number; t: number } | null = null;
  private droneIdle: ReturnType<typeof setTimeout> | null = null;

  // --- State -----------------------------------------------------------------

  get enabled(): boolean {
    return this.on;
  }

  /** Running, so a voice would be heard. */
  private get live(): boolean {
    return this.on && this.ctx?.state === "running";
  }

  get analyser(): AnalyserNode | null {
    return this.ctx ? this.analyserNode : null;
  }

  subscribe(f: Sub): () => void {
    this.subs.add(f);
    return () => this.subs.delete(f);
  }

  /** Read the saved choice. A remembered "on" starts at the first gesture. */
  restore(): void {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {}
    if (saved !== "on" || this.on) return;
    this.on = true;
    this.subs.forEach((f) => f());
    this.awaitGesture();
  }

  /** From the switch — itself a gesture, so the context can start now. */
  toggle(): void {
    this.set(!this.on);
  }

  set(next: boolean): void {
    if (next === this.on) return;
    try {
      window.localStorage.setItem(KEY, next ? "on" : "off");
    } catch {}
    if (next) {
      this.on = true;
      this.start();
      this.powerOn();
    } else {
      this.powerOff();
      this.stopHeld();
      this.on = false;
    }
    this.subs.forEach((f) => f());
  }

  private awaitGesture(): void {
    if (this.waiting) return;
    this.waiting = true;
    const go = () => {
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      this.waiting = false;
      if (this.on) this.start();
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
  }

  private start(): void {
    if (!this.ctx) this.build();
    if (this.ctx!.state !== "running") void this.ctx!.resume();
  }

  private build(): void {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;

    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    // A short tape echo, darkened, for a little room.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    bus.connect(comp);
    const dry = ctx.createGain();
    dry.connect(comp);
    bus.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(wet);
    wet.connect(comp);
    comp.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    // Two seconds of white noise, shared by every noisy voice.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.bus = bus;
    this.dry = dry;
    this.master = master;
    this.analyserNode = analyser;
    this.noise = noise;
  }

  // --- Building blocks -----------------------------------------------------------

  private env(gain: GainNode, at: number, peak: number, attack: number, decay: number): number {
    const g = gain.gain;
    g.setValueAtTime(0.0001, at);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    g.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return at + attack + decay + 0.02;
  }

  private tone(
    type: OscillatorType,
    freq: number,
    at: number,
    peak: number,
    attack: number,
    decay: number,
    to?: number,
    out: AudioNode = this.bus
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    const g = ctx.createGain();
    o.connect(g).connect(out);
    o.start(at);
    o.stop(this.env(g, at, peak, attack, decay));
  }

  /** A burst of noise through a band — clicks, ticks, crackle. */
  private burst(
    freq: number,
    q: number,
    at: number,
    peak: number,
    decay: number,
    type: BiquadFilterType = "bandpass",
    out: AudioNode = this.bus,
    attack = 0.001
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(out);
    src.start(at, Math.random() * 1.5);
    src.stop(this.env(g, at, peak, attack, decay));
  }

  private get now(): number {
    return this.ctx!.currentTime + 0.005;
  }

  // --- Voices --------------------------------------------------------------------

  /** Hover on an article: a soft glassy note. */
  ping(freq: number): void {
    if (!this.live) return;
    const t = this.now;
    this.tone("sine", freq, t, 0.16, 0.004, 0.32);
    this.tone("sine", freq * 2.005, t, 0.05, 0.002, 0.14);
    this.tone("triangle", freq * 4, t, 0.025, 0.001, 0.05);
    this.burst(5200, 6, t, 0.03, 0.012);
  }

  /**
   * Hover on a link or a button, after fundomo's company-list hover. Matched
   * by measurement, not sampled: the peak inside half a millisecond, partials
   * at ~630 Hz and 1 kHz over a 100–250 Hz floor, a little air at 4 and
   * 10 kHz, down 15 dB in 5 ms, then a broad body under 1 kHz holding near
   * −33 dB for ~70 ms; no room. Like theirs, a new tap cuts the last one off,
   * so a quick pass down a list stays a clean run.
   */
  tap(): void {
    if (!this.live) return;
    const ctx = this.ctx!;
    const t = this.now;
    if (this.lastTap) {
      this.lastTap.gain.setValueAtTime(this.lastTap.gain.value, t);
      this.lastTap.gain.linearRampToValueAtTime(0, t + 0.004);
    }
    const out = ctx.createGain();
    out.connect(this.dry);
    this.lastTap = out;
    // The hit: two damped partials, each dipping a little, and a tick of air.
    this.tone("sine", 640, t, 0.054, 0.0003, 0.008, 560, out);
    this.tone("sine", 1000, t, 0.036, 0.0003, 0.006, 900, out);
    this.burst(9000, 0.7, t, 0.036, 0.0012, "highpass", out);
    // The body: a low thump, and noise under 1 kHz swelling in and holding.
    this.tone("sine", 140, t, 0.018, 0.0008, 0.06, 100, out);
    this.burst(700, 0.7, t + 0.003, 0.027, 0.22, "lowpass", out, 0.014);
    this.burst(4000, 1.2, t + 0.003, 0.0065, 0.08, "bandpass", out, 0.01);
    setTimeout(() => out.disconnect(), 400);
  }

  /** A press: a switch closing — two contacts and a little body. */
  press(): void {
    if (!this.live) return;
    const t = this.now;
    this.burst(2200, 5, t, 0.22, 0.02);
    this.burst(1200, 4, t + 0.024, 0.14, 0.03);
    this.tone("sine", 150, t, 0.12, 0.002, 0.06, 90);
  }

  /** A chapter step: a detent. */
  detent(): void {
    if (!this.live) return;
    const t = this.now;
    this.burst(2800, 8, t, 0.3, 0.012);
    this.burst(900, 5, t + 0.014, 0.2, 0.02);
    this.tone("sine", 220, t, 0.05, 0.001, 0.05);
  }

  /** An article flying open (rising) or folding home (falling), over `dur` s. */
  sweep(open: boolean, dur: number): void {
    if (!this.live) return;
    const ctx = this.ctx!;
    const t = this.now;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.6;
    const [lo, hi] = [260, 3600];
    f.frequency.setValueAtTime(open ? lo : hi, t);
    f.frequency.exponentialRampToValueAtTime(open ? hi : lo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t);
    src.stop(t + dur + 0.05);
    this.tone("sine", open ? note(0) : note(5), t, 0.05, dur * 0.5, dur * 0.5, open ? note(5) : note(0));
  }

  /** Text typing in: `count` tiny clicks scattered over `dur` s. */
  chatter(count: number, dur: number): void {
    if (!this.live) return;
    const t = this.now;
    const n = Math.min(count, 36);
    for (let i = 0; i < n; i++) {
      const at = t + (dur * i) / n + Math.random() * 0.012;
      this.burst(2400 + Math.random() * 3200, 6, at, 0.18 + Math.random() * 0.1, 0.008);
    }
  }

  /** The clock, ticking on the second while hovered. */
  clockOn(): void {
    if (!this.live || this.clockTimer) return;
    const beat = () => {
      this.clockAlt = !this.clockAlt;
      if (this.live) {
        const t = this.now;
        this.burst(this.clockAlt ? 3100 : 2300, 8, t, 0.4, 0.014);
        this.tone("sine", this.clockAlt ? 1550 : 1150, t, 0.05, 0.001, 0.04);
      }
      this.clockTimer = setTimeout(beat, 1000 - (Date.now() % 1000));
    };
    this.clockTimer = setTimeout(beat, 1000 - (Date.now() % 1000));
  }

  clockOff(): void {
    if (this.clockTimer) clearTimeout(this.clockTimer);
    this.clockTimer = null;
  }

  /**
   * The globe's bend, every frame (0 perspective … 1 orthographic). The drone
   * sounds only while the bend is moving — louder the faster — and climbs an
   * octave and opens up as it bends.
   */
  bend(v: number): void {
    const now = performance.now() / 1000;
    const last = this.droneLast;
    this.droneLast = { v, t: now };
    if (!this.live || !last) return;
    const speed = Math.abs(v - last.v) / Math.max(now - last.t, 1 / 240);
    // The bend eases toward its target, so it creeps for a while after the
    // wheel stops; under this it counts as still.
    const moving = speed > 0.04;
    if (!moving && !this.drone) return;

    const ctx = this.ctx!;
    if (!this.drone) {
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = "sawtooth";
      b.type = "sawtooth";
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain).connect(this.bus);
      a.start();
      b.start();
      this.drone = { a, b, filter, gain };
    }
    const t = ctx.currentTime;
    const f = 55 * Math.pow(2, v);
    this.drone.a.frequency.setTargetAtTime(f, t, 0.05);
    this.drone.b.frequency.setTargetAtTime(f * 1.007, t, 0.05);
    this.drone.filter.frequency.setTargetAtTime(180 + v * 1600 + speed * 900, t, 0.06);
    this.drone.gain.gain.setTargetAtTime(moving ? Math.min(0.06, speed * 0.05) : 0, t, 0.07);

    // Once it's still, settle to silence and let the voice go.
    if (!moving) return;
    if (this.droneIdle) clearTimeout(this.droneIdle);
    this.droneIdle = setTimeout(() => this.releaseDrone(), 700);
  }

  private releaseDrone(): void {
    const d = this.drone;
    this.drone = null;
    if (!d || !this.ctx) return;
    const t = this.ctx.currentTime;
    d.gain.gain.setTargetAtTime(0.0001, t, 0.08);
    d.a.stop(t + 0.6);
    d.b.stop(t + 0.6);
  }

  /** The theme flipped: a relay closing, then the tubes coming on — or a whine down. */
  lights(theme: "light" | "dark"): void {
    if (!this.live) return;
    const t = this.now;
    // The relay
    this.tone("sine", 90, t, 0.26, 0.002, 0.14, 38);
    this.burst(380, 1.2, t, 0.3, 0.05, "lowpass");
    this.burst(2600, 4, t + 0.006, 0.12, 0.01);
    if (theme === "light") this.flicker(t + 0.05, [0.03, 0.06, 0.02, 0.09, 0.04, 0.05, 0.3], 0.05);
    else this.tone("sine", 1400, t + 0.03, 0.04, 0.01, 0.55, 140);
  }

  /** A fluorescent tube's buzz, gated on and off: `steps` alternate on, off, on… (s). */
  private flicker(at: number, steps: number[], peak: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 100;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    let t = at;
    steps.forEach((s, i) => {
      const last = i === steps.length - 1;
      g.gain.setValueAtTime(i % 2 === 0 ? peak : 0, t);
      if (last && i % 2 === 0) g.gain.setTargetAtTime(0, t + s * 0.3, s * 0.4);
      t += s;
    });
    o.connect(bp).connect(g).connect(this.bus);
    o.start(at);
    o.stop(t + 0.4);
  }

  /** The switch turned on: three rising notes and a flicker of the tube. */
  private powerOn(): void {
    if (!this.ctx) return;
    // The context may still be resuming; voices scheduled now play when it does.
    const run = () => {
      const t = this.now;
      [0, 4, 7].forEach((s, i) => {
        this.tone("sine", note(s + 5), t + i * 0.085, 0.13, 0.004, 0.4);
        this.tone("sine", note(s + 10), t + i * 0.085, 0.03, 0.002, 0.12);
      });
      this.flicker(t + 0.02, [0.025, 0.05, 0.02, 0.07, 0.03, 0.04, 0.12], 0.035);
    };
    if (this.ctx.state === "running") run();
    else void this.ctx.resume().then(run);
  }

  /** The switch turned off: one falling note, then quiet. */
  private powerOff(): void {
    if (!this.live) return;
    const t = this.now;
    this.tone("sine", note(10), t, 0.1, 0.004, 0.3, note(5));
  }

  private stopHeld(): void {
    this.clockOff();
    this.releaseDrone();
  }
}

/** The one instance; created on first import in the browser. */
export const sfx = new Sfx();

// Dev only: lets the console play and inspect it.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production")
  (window as unknown as { __sfx?: Sfx }).__sfx = sfx;

/** Each article's note on hover: the globe low, the work above it. */
export const ARTICLE_NOTES: Record<string, number> = {
  globe: note(5),
  watch: note(7),
  fractals: note(9),
};
