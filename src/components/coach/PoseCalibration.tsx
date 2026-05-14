import { useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePose } from "@/hooks/usePose";
import { drawSkeleton } from "@/lib/drawSkeleton";
import { LM } from "@/lib/biomechanics";
import type { Pt } from "@/lib/oneEuroFilter";

type CalibState = "ok" | "warn" | "bad";

interface Check {
  id: string;
  label: string;
  state: CalibState;
  hint: string;
}

interface Props {
  onCalibrated?: () => void;
}

const INITIAL_CHECKS: Check[] = [
  { id: "person", label: "Persona detectada", state: "bad", hint: "Colócate frente a la cámara" },
  { id: "frame", label: "Cuerpo completo en cuadro", state: "bad", hint: "Asegúrate de que se vean cabeza y tobillos" },
  { id: "distance", label: "Distancia ideal", state: "bad", hint: "Ajusta tu distancia a la cámara" },
  { id: "light", label: "Iluminación suficiente", state: "bad", hint: "Necesitas más luz en la escena" },
  { id: "centered", label: "Bien centrado", state: "bad", hint: "Muévete al centro del cuadro" },
];

export function PoseCalibration({ onCalibrated }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stableFramesRef = useRef(0);

  const [checks, setChecks] = useState<Check[]>(INITIAL_CHECKS);
  const [message, setMessage] = useState("Preparando cámara…");
  const [readyPct, setReadyPct] = useState(0);
  const [estHeight, setEstHeight] = useState<number | null>(null);

  const { status, error, fps } = usePose(videoRef, {
    model: "heavy",
    minCutoff: 1.2,
    beta: 0.05,
    onFrame: (lm, _raw, video) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);

      // Brightness sample
      const tmp = document.createElement("canvas");
      tmp.width = 32; tmp.height = 18;
      const tctx = tmp.getContext("2d")!;
      tctx.drawImage(video, 0, 0, tmp.width, tmp.height);
      const px = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const brightness = sum / (px.length / 4);

      const next = INITIAL_CHECKS.map((c) => ({ ...c }));
      if (brightness > 110) next[3] = { ...next[3], state: "ok", hint: "Buena iluminación" };
      else if (brightness > 75) next[3] = { ...next[3], state: "warn", hint: "Más luz recomendada" };

      let msg = "Colócate frente a la cámara";

      if (lm && lm.length) {
        next[0] = { ...next[0], state: "ok", hint: "Detectado" };
        drawSkeleton(ctx, lm, w, h);

        const inFrame = (p: Pt) =>
          p && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98 && (p.visibility ?? 1) > 0.5;

        const nose = lm[LM.nose];
        const lAnk = lm[LM.leftAnkle];
        const rAnk = lm[LM.rightAnkle];
        const lSh = lm[LM.leftShoulder];
        const rSh = lm[LM.rightShoulder];
        const lHip = lm[LM.leftHip];
        const rHip = lm[LM.rightHip];

        const headOk = inFrame(nose);
        const feetOk = inFrame(lAnk) && inFrame(rAnk);
        const torsoOk = inFrame(lSh) && inFrame(rSh) && inFrame(lHip) && inFrame(rHip);

        if (headOk && feetOk && torsoOk) next[1] = { ...next[1], state: "ok", hint: "Cuerpo completo" };
        else if (torsoOk && (headOk || feetOk)) {
          next[1] = { ...next[1], state: "warn", hint: !feetOk ? "No veo tus pies" : "No veo tu cabeza" };
          msg = !feetOk ? "Aleja la cámara para ver tus pies" : "Ajusta la cámara para ver tu cabeza";
        } else {
          msg = "Encuadra todo tu cuerpo";
        }

        if (nose && lAnk && rAnk) {
          const ankleY = Math.max(lAnk.y, rAnk.y);
          const bodyHeight = ankleY - nose.y;
          setEstHeight(bodyHeight);
          if (bodyHeight > 0.95) {
            next[2] = { ...next[2], state: "warn", hint: "Aléjate un paso" };
            msg = "Aléjate un paso de la cámara";
          } else if (bodyHeight < 0.45) {
            next[2] = { ...next[2], state: "warn", hint: "Acércate un paso" };
            msg = "Acércate un paso a la cámara";
          } else if (bodyHeight >= 0.55 && bodyHeight <= 0.9) {
            next[2] = { ...next[2], state: "ok", hint: "Distancia perfecta" };
          } else {
            next[2] = { ...next[2], state: "warn", hint: "Casi en la distancia ideal" };
          }
        }

        if (lHip && rHip) {
          const cx = (lHip.x + rHip.x) / 2;
          const offset = Math.abs(cx - 0.5);
          if (offset < 0.08) next[4] = { ...next[4], state: "ok", hint: "Centrado" };
          else if (offset < 0.18) next[4] = { ...next[4], state: "warn", hint: cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha" };
          else {
            next[4] = { ...next[4], state: "bad", hint: cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha" };
            msg = cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha";
          }
        }
      } else {
        stableFramesRef.current = 0;
      }

      const okCount = next.filter((c) => c.state === "ok").length;
      const pct = Math.round((okCount / next.length) * 100);
      setReadyPct(pct);
      setChecks(next);

      if (okCount === next.length) {
        stableFramesRef.current += 1;
        setMessage("Listo para analizar");
      } else {
        stableFramesRef.current = 0;
        setMessage(msg);
      }
    },
  });

  const allGood = checks.every((c) => c.state === "ok");

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[1fr_360px]">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-border">
        <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-primary/40" />

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
          <span className={`h-2 w-2 rounded-full ${allGood ? "bg-[hsl(var(--success))]" : "bg-primary animate-pulse-ring"}`} />
          {status === "loading" ? "Cargando IA…" : status === "no-camera" ? "Sin cámara" : message}
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full glass px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {fps} fps · Heavy
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="glass rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Calibración</span>
              <span className="font-semibold text-foreground">{readyPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-gradient-electric transition-all" style={{ width: `${readyPct}%` }} />
            </div>
          </div>
        </div>

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Inicializando MediaPipe Pose Heavy…
          </div>
        )}
        {status === "no-camera" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="h-8 w-8 text-primary" />
            <p className="font-semibold">No pudimos acceder a tu cámara</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4 rounded-2xl glass p-5 shadow-card">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Calibración</p>
          <h2 className="mt-1 text-2xl font-bold">Ajustes en tiempo real</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cumple las 5 condiciones para un análisis biomecánico de máxima precisión.
          </p>
        </div>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 transition-smooth">
              <span className="mt-0.5">
                {c.state === "ok" ? (
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                ) : c.state === "warn" ? (
                  <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-muted-foreground/40" />
                )}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.hint}</p>
              </div>
            </li>
          ))}
        </ul>

        {estHeight !== null && (
          <div className="rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
            Altura estimada en cuadro: <span className="font-mono text-foreground">{(estHeight * 100).toFixed(0)}%</span>
          </div>
        )}

        <Button
          size="lg"
          disabled={!allGood}
          onClick={() => onCalibrated?.()}
          className="mt-2 h-12 bg-gradient-electric text-base font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {allGood ? "Comenzar análisis" : `Calibrando… ${readyPct}%`}
        </Button>
      </aside>
    </div>
  );
}
