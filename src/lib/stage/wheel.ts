/**
 * One scroll gesture = one chapter, for the walkthroughs (watch, fractals).
 *
 * The first `threshold` px of a gesture steps once; the rest of it — a hard
 * scroll, trackpad momentum — is ignored. A new gesture is recognised by the
 * wheel going quiet, reversing, or dipping and then speeding up again —
 * momentum only ever decays, and a new swipe starts slow — after at least
 * `minLock` ms. One continuous spin, even an accelerating one, never dips, so
 * it stays one gesture.
 */
export const WHEEL = {
  /** Wheel travel in one gesture that counts as a scroll, px. */
  threshold: 24,
  /** A gap this long between wheel events ends a gesture, ms. */
  quiet: 220,
  /** After a step, the soonest another gesture can step, ms. */
  minLock: 350,
  /**
   * A new swipe inside momentum: the mean of the last 4 wheel deltas beats the 4
   * before it by this factor, plus `riseFloor` px, and is at least `riseMin` px.
   */
  riseFactor: 1.3,
  riseFloor: 2,
  riseMin: 8,
  /** …and only after the deltas have fallen to this fraction of their peak since the step. */
  dip: 0.6,
} as const;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export class WheelGesture {
  private sum = 0;
  private locked = false;
  private lockedAt = 0;
  /** Largest |delta| since the last step, and whether the stream has dipped below it since. */
  private peak = 0;
  private dipped = false;
  private dir = 0;
  /** |delta| of the latest wheel events in this gesture, newest last. */
  private deltas: number[] = [];
  private last = 0;

  /** Forget the gesture in progress (input turned off, article closed). */
  reset(): void {
    this.sum = 0;
    this.locked = false;
    this.deltas = [];
  }

  /** Feed a wheel delta, px. Returns the direction to step (−1 / 1), or 0. */
  feed(dy: number, now = performance.now()): number {
    if (!dy) return 0;
    const dir = Math.sign(dy);
    if (now - this.last > WHEEL.quiet || dir !== this.dir) {
      // A new gesture: the wheel went still, or turned round.
      this.locked = false;
      this.sum = 0;
      this.deltas = [];
      this.dir = dir;
    }
    this.last = now;
    this.deltas.push(Math.abs(dy));
    if (this.deltas.length > 8) this.deltas.shift();

    if (this.locked) {
      const size = Math.abs(dy);
      this.peak = Math.max(this.peak, size);
      if (size <= this.peak * WHEEL.dip) this.dipped = true;
      if (now - this.lockedAt < WHEEL.minLock || !this.dipped || !this.speedingUp()) return 0;
      this.locked = false; // a fresh swipe on top of the last one's momentum
      this.sum = 0;
    }
    this.sum += dy;
    if (Math.abs(this.sum) < WHEEL.threshold) return 0;
    this.locked = true;
    this.lockedAt = now;
    this.peak = 0;
    this.dipped = false;
    this.sum = 0;
    this.deltas = [];
    return dir;
  }

  /** Momentum only decays; deltas growing again mean a finger is back on the trackpad. */
  private speedingUp(): boolean {
    if (this.deltas.length < 8) return false;
    const older = mean(this.deltas.slice(0, 4));
    const newer = mean(this.deltas.slice(4));
    return newer >= WHEEL.riseMin && newer > older * WHEEL.riseFactor + WHEEL.riseFloor;
  }
}
