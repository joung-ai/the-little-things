export const Ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  ease: (t: number) => number;
  done: () => void;
}

/**
 * Game-time tweens. Paused whenever the game clock is paused (menus), and
 * cleared on scene changes so stale cutscenes never resume.
 */
export class Tweens {
  private list: Tween[] = [];
  generation = 0;

  update(dt: number): void {
    if (!this.list.length) return;
    const current = this.list.slice();
    for (const tw of current) {
      tw.t += dt;
      const k = Math.min(1, tw.dur <= 0 ? 1 : tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.list.splice(this.list.indexOf(tw), 1);
        tw.done();
      }
    }
  }

  to(dur: number, fn: (k: number) => void, ease: (t: number) => number = Ease.inOut): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({ t: 0, dur, fn, ease, done: resolve });
    });
  }

  wait(sec: number): Promise<void> {
    return this.to(sec, () => {}, Ease.linear);
  }

  clear(): void {
    this.list = [];
    this.generation++;
  }
}
