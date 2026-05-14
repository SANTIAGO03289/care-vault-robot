import { POSE_CONNECTIONS } from "@/lib/biomechanics";
import type { Pt } from "@/lib/oneEuroFilter";

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: Pt[],
  w: number,
  h: number,
  opts: { color?: string; glow?: string; lineWidth?: number; pointRadius?: number } = {},
) {
  const color = opts.color ?? "rgba(56, 189, 248, 0.95)";
  const glow = opts.glow ?? "rgba(56, 189, 248, 0.65)";
  ctx.lineWidth = opts.lineWidth ?? 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = lm[a];
    const pb = lm[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgb(96, 165, 250)";
  const r = opts.pointRadius ?? 4;
  for (const p of lm) {
    if ((p.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
