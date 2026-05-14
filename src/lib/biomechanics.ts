// Biomechanics helpers — angle calculations and per-sport scoring.
import type { Pt } from "./oneEuroFilter";

export const LM = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const;

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31], [27, 29],
  [24, 26], [26, 28], [28, 32], [28, 30],
  [0, 11], [0, 12],
];

export function angleDeg(a: Pt, b: Pt, c: Pt) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (!m1 || !m2) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const lerp = (v: number, a: number, b: number) => Math.max(0, Math.min(100, ((v - a) / (b - a)) * 100));
const score = (v: number, ideal: number, tolerance: number) => {
  const diff = Math.abs(v - ideal);
  return Math.max(0, 100 - (diff / tolerance) * 100);
};

export type SportKey = "squat" | "boxing" | "skating";

export interface MetricScore {
  posture: number;
  balance: number;
  execution: number;
  control: number;
  overall: number;
}

export interface AnalysisResult {
  reps?: number;
  state?: string;
  feedback: { ok: boolean; text: string }[];
  metrics: MetricScore;
  angles: Record<string, number>;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

// ---------- SQUAT ----------
export class SquatAnalyzer {
  reps = 0;
  private state: "up" | "down" = "up";
  private depthHist: number[] = [];

  analyze(lm: Pt[]): AnalysisResult {
    const lKnee = angleDeg(lm[LM.leftHip], lm[LM.leftKnee], lm[LM.leftAnkle]);
    const rKnee = angleDeg(lm[LM.rightHip], lm[LM.rightKnee], lm[LM.rightAnkle]);
    const knee = (lKnee + rKnee) / 2;
    const lHip = angleDeg(lm[LM.leftShoulder], lm[LM.leftHip], lm[LM.leftKnee]);
    const rHip = angleDeg(lm[LM.rightShoulder], lm[LM.rightHip], lm[LM.rightKnee]);
    const hip = (lHip + rHip) / 2;
    const back = angleDeg(
      { x: (lm[LM.leftShoulder].x + lm[LM.rightShoulder].x) / 2, y: (lm[LM.leftShoulder].y + lm[LM.rightShoulder].y) / 2 },
      { x: (lm[LM.leftHip].x + lm[LM.rightHip].x) / 2, y: (lm[LM.leftHip].y + lm[LM.rightHip].y) / 2 },
      { x: (lm[LM.leftHip].x + lm[LM.rightHip].x) / 2, y: 1 },
    );

    // rep counting
    if (this.state === "up" && knee < 100) this.state = "down";
    else if (this.state === "down" && knee > 160) {
      this.state = "up";
      this.reps += 1;
    }

    if (this.state === "down") this.depthHist.push(knee);
    if (this.depthHist.length > 30) this.depthHist.shift();

    const symmetry = 100 - Math.min(100, Math.abs(lKnee - rKnee) * 4);
    const depthScore = this.state === "down" ? score(knee, 90, 35) : 70;
    const backScore = score(back, 15, 35);
    const hipScore = score(hip, 70, 50);

    const feedback: { ok: boolean; text: string }[] = [];
    if (knee > 130 && this.state === "down") feedback.push({ ok: false, text: "Baja más, busca 90° en rodilla" });
    if (back > 35) feedback.push({ ok: false, text: "Espalda muy inclinada, mantén el torso erguido" });
    if (Math.abs(lKnee - rKnee) > 18) feedback.push({ ok: false, text: "Asimetría: una rodilla baja más que la otra" });
    if (lm[LM.leftKnee].x > lm[LM.leftAnkle].x + 0.05 && lm[LM.rightKnee].x < lm[LM.rightAnkle].x - 0.05)
      feedback.push({ ok: false, text: "Rodillas hacia dentro: empújalas hacia afuera" });
    if (!feedback.length) feedback.push({ ok: true, text: "Técnica sólida, mantén el ritmo" });

    const metrics: MetricScore = {
      posture: Math.round(backScore),
      balance: Math.round(symmetry),
      execution: Math.round(depthScore),
      control: Math.round(hipScore),
      overall: 0,
    };
    metrics.overall = Math.round(avg([metrics.posture, metrics.balance, metrics.execution, metrics.control]));

    return {
      reps: this.reps,
      state: this.state === "down" ? "Bajando" : "Arriba",
      feedback,
      metrics,
      angles: { Rodilla: knee, Cadera: hip, Espalda: back },
    };
  }
}

// ---------- BOXING ----------
export class BoxingAnalyzer {
  punches = 0;
  private cooldown = 0;
  private lastWristY = { l: 1, r: 1 };

  analyze(lm: Pt[]): AnalysisResult {
    const lElbow = angleDeg(lm[LM.leftShoulder], lm[LM.leftElbow], lm[LM.leftWrist]);
    const rElbow = angleDeg(lm[LM.rightShoulder], lm[LM.rightElbow], lm[LM.rightWrist]);
    const guardL = lm[LM.leftWrist].y < lm[LM.leftShoulder].y + 0.05;
    const guardR = lm[LM.rightWrist].y < lm[LM.rightShoulder].y + 0.05;
    const guard = guardL && guardR;

    // detect extension (jab/cross)
    if (this.cooldown > 0) this.cooldown -= 1;
    const extL = lElbow > 160 && lm[LM.leftWrist].y < lm[LM.leftShoulder].y + 0.1;
    const extR = rElbow > 160 && lm[LM.rightWrist].y < lm[LM.rightShoulder].y + 0.1;
    if ((extL || extR) && this.cooldown === 0) {
      this.punches += 1;
      this.cooldown = 10;
    }
    this.lastWristY = { l: lm[LM.leftWrist].y, r: lm[LM.rightWrist].y };

    const stance = Math.abs(lm[LM.leftAnkle].x - lm[LM.rightAnkle].x);
    const stanceScore = score(stance, 0.18, 0.18);
    const guardScore = (guardL ? 50 : 20) + (guardR ? 50 : 20);
    const extScore = score(Math.max(lElbow, rElbow), 175, 35);
    const hipShoulderTwist = Math.abs(
      Math.atan2(lm[LM.rightShoulder].y - lm[LM.leftShoulder].y, lm[LM.rightShoulder].x - lm[LM.leftShoulder].x) -
        Math.atan2(lm[LM.rightHip].y - lm[LM.leftHip].y, lm[LM.rightHip].x - lm[LM.leftHip].x),
    );
    const transferScore = Math.min(100, hipShoulderTwist * 200);

    const feedback: { ok: boolean; text: string }[] = [];
    if (!guard) feedback.push({ ok: false, text: "Sube la guardia, manos cerca del mentón" });
    if (stance < 0.1) feedback.push({ ok: false, text: "Pies muy juntos, abre la base" });
    if (Math.max(lElbow, rElbow) > 178) feedback.push({ ok: false, text: "No bloquees el codo al extender" });
    if (!feedback.length) feedback.push({ ok: true, text: "Buena técnica, sigue así" });

    const metrics: MetricScore = {
      posture: Math.round(guardScore),
      balance: Math.round(stanceScore),
      execution: Math.round(extScore),
      control: Math.round(transferScore || 50),
      overall: 0,
    };
    metrics.overall = Math.round(avg([metrics.posture, metrics.balance, metrics.execution, metrics.control]));

    return {
      reps: this.punches,
      state: guard ? "Guardia activa" : "Sin guardia",
      feedback,
      metrics,
      angles: { "Codo izq": lElbow, "Codo der": rElbow },
    };
  }
}

// ---------- SKATING ----------
export class SkatingAnalyzer {
  private leanHist: number[] = [];

  analyze(lm: Pt[]): AnalysisResult {
    const shoulderMid = {
      x: (lm[LM.leftShoulder].x + lm[LM.rightShoulder].x) / 2,
      y: (lm[LM.leftShoulder].y + lm[LM.rightShoulder].y) / 2,
    };
    const hipMid = {
      x: (lm[LM.leftHip].x + lm[LM.rightHip].x) / 2,
      y: (lm[LM.leftHip].y + lm[LM.rightHip].y) / 2,
    };
    const torsoLean = Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y) * (180 / Math.PI);
    this.leanHist.push(torsoLean);
    if (this.leanHist.length > 30) this.leanHist.shift();

    const lKnee = angleDeg(lm[LM.leftHip], lm[LM.leftKnee], lm[LM.leftAnkle]);
    const rKnee = angleDeg(lm[LM.rightHip], lm[LM.rightKnee], lm[LM.rightAnkle]);
    const symmetry = 100 - Math.min(100, Math.abs(lKnee - rKnee) * 3);
    const aero = score(Math.abs(torsoLean), 30, 30);
    const stability = 100 - Math.min(100, Math.abs(lm[LM.leftHip].y - lm[LM.rightHip].y) * 600);
    const power = score((lKnee + rKnee) / 2, 120, 50);

    const feedback: { ok: boolean; text: string }[] = [];
    if (Math.abs(torsoLean) < 15) feedback.push({ ok: false, text: "Inclínate más hacia adelante para postura aerodinámica" });
    if (Math.abs(lKnee - rKnee) > 20) feedback.push({ ok: false, text: "Asimetría en piernas, equilibra el impulso" });
    if (Math.abs(lm[LM.leftHip].y - lm[LM.rightHip].y) > 0.05) feedback.push({ ok: false, text: "Cadera desnivelada, baja el centro de masa" });
    if (!feedback.length) feedback.push({ ok: true, text: "Postura aerodinámica óptima" });

    const metrics: MetricScore = {
      posture: Math.round(aero),
      balance: Math.round(stability),
      execution: Math.round(power),
      control: Math.round(symmetry),
      overall: 0,
    };
    metrics.overall = Math.round(avg([metrics.posture, metrics.balance, metrics.execution, metrics.control]));

    return {
      state: `Inclinación ${Math.round(Math.abs(torsoLean))}°`,
      feedback,
      metrics,
      angles: { "Rodilla izq": lKnee, "Rodilla der": rKnee, "Inclinación": Math.abs(torsoLean) },
    };
  }
}

export function makeAnalyzer(sport: SportKey) {
  if (sport === "squat") return new SquatAnalyzer();
  if (sport === "boxing") return new BoxingAnalyzer();
  return new SkatingAnalyzer();
}
