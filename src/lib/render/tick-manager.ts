/**
 * TickManager - Centralized animation loop with timestamp and delta time.
 * Adapted from https://github.com/visionary-3d/shaders-crash-course
 *
 * Dispatches 'tick' events with { timestamp, timeDiff, frame } for shader uniforms
 * and frame-rate-independent animations.
 */

export interface TickData {
  timestamp: number;
  timeDiff: number;
  frame: number | null;
}

const localData: TickData = {
  timestamp: 0,
  timeDiff: 0,
  frame: null,
};

const frameEvent = new MessageEvent("tick", { data: localData });

export class TickManager extends EventTarget {
  private lastTimestamp = 0;
  private animationLoopId: number | null = null;

  startLoop(render: (data: TickData) => void): void {
    const animate = (timestamp: number) => {
      this.animationLoopId = requestAnimationFrame(animate);

      const now = timestamp ?? performance.now();
      localData.timestamp = now;
      localData.timeDiff = this.lastTimestamp ? now - this.lastTimestamp : 0;
      localData.frame = null;

      // Cap timeDiff to avoid huge jumps (e.g. tab switch)
      const timeDiffCapped = Math.min(Math.max(localData.timeDiff, 0), 100);
      localData.timeDiff = timeDiffCapped;

      this.lastTimestamp = now;

      // Dispatch tick BEFORE render so listeners can update uniforms for this frame
      this.dispatchEvent(frameEvent);

      render(localData);
    };

    this.animationLoopId = requestAnimationFrame(animate);
  }

  stopLoop(): void {
    if (this.animationLoopId !== null) {
      cancelAnimationFrame(this.animationLoopId);
      this.animationLoopId = null;
    }
  }

  static useTick(manager: TickManager | null, fn: (data: TickData) => void): () => void {
    if (!manager) return () => {};

    const handler = (e: Event) => {
      fn((e as MessageEvent).data);
    };
    manager.addEventListener("tick", handler);
    return () => manager.removeEventListener("tick", handler);
  }
}
