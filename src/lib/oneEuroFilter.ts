// One Euro Filter — low-latency smoothing for noisy signals (e.g. landmark coords).
// Reference: Casiez et al. https://gery.casiez.net/1euro/

class LowPass {
  private y: number | null = null;
  private s: number | null = null;
  filter(x: number, alpha: number) {
    this.s = this.y === null ? x : alpha * x + (1 - alpha) * (this.s as number);
    this.y = x;
    return this.s;
  }
  lastRaw() {
    return this.y;
  }
}

export class OneEuroFilter {
  private xFilter = new LowPass();
  private dxFilter = new LowPass();
  private lastTime: number | null = null;
  constructor(
    private minCutoff = 1.0,
    private beta = 0.02,
    private dCutoff = 1.0,
  ) {}

  private alpha(rate: number, cutoff: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    const te = 1 / rate;
    return 1 / (1 + tau / te);
  }

  filter(x: number, t: number) {
    if (this.lastTime === null) {
      this.lastTime = t;
      return this.xFilter.filter(x, 1);
    }
    const dt = Math.max(1e-3, (t - this.lastTime) / 1000);
    this.lastTime = t;
    const rate = 1 / dt;
    const prev = this.xFilter.lastRaw() ?? x;
    const dx = (x - prev) * rate;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(rate, cutoff));
  }
}

export type Pt = { x: number; y: number; z?: number; visibility?: number };

export class LandmarkSmoother {
  private filters = new Map<number, { x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }>();
  constructor(private minCutoff = 1.2, private beta = 0.05) {}

  smooth(landmarks: Pt[], t = performance.now()): Pt[] {
    return landmarks.map((p, i) => {
      let f = this.filters.get(i);
      if (!f) {
        f = {
          x: new OneEuroFilter(this.minCutoff, this.beta),
          y: new OneEuroFilter(this.minCutoff, this.beta),
          z: new OneEuroFilter(this.minCutoff, this.beta),
        };
        this.filters.set(i, f);
      }
      return {
        x: f.x.filter(p.x, t),
        y: f.y.filter(p.y, t),
        z: p.z !== undefined ? f.z.filter(p.z, t) : undefined,
        visibility: p.visibility,
      };
    });
  }

  reset() {
    this.filters.clear();
  }
}
