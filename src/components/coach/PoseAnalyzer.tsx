import { useRef, useState } from "react";
import { Loader2, Camera, Activity } from "lucide-react";
import { usePose } from "@/hooks/usePose";
import { drawSkeleton } from "@/lib/drawSkeleton";
import { makeAnalyzer, type AnalysisResult, type SportKey } from "@/lib/biomechanics";

interface Props {
  sport: SportKey;
}

const SPORT_META: Record<SportKey, { label: string; hint: string }> = {
  squat: { label: "Sentadillas", hint: "Cuenta repeticiones, mide profundidad y simetría." },
  boxing: { label: "Boxeo", hint: "Cuenta golpes, evalúa guardia, balance y extensión." },
  skating: { label: "Patinaje", hint: "Mide inclinación aerodinámica, simetría y estabilidad." },
};

export function PoseAnalyzer({ sport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef(makeAnalyzer(sport));
  const lastSportRef = useRef(sport);

  const [result, setResult] = useState<AnalysisResult | null>(null);

  if (lastSportRef.current !== sport) {
    analyzerRef.current = makeAnalyzer(sport);
    lastSportRef.current = sport;
    setResult(null);
  }

  const { status, error, fps } = usePose(videoRef, {
    model: "heavy",
    minCutoff: 1.5,
    beta: 0.04,
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
      if (lm && lm.length) {
        drawSkeleton(ctx, lm, w, h);
        const r = analyzerRef.current.analyze(lm);
        setResult(r);
      }
    },
  });

  const meta = SPORT_META[sport];

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[1fr_380px]">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-border">
        <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
          <Activity className="h-3.5 w-3.5 text-primary" />
          {meta.label} · en vivo
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full glass px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {fps} fps · Heavy
        </div>

        {result?.reps !== undefined && (
          <div className="absolute bottom-4 left-4 rounded-2xl glass px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {sport === "boxing" ? "Golpes" : "Reps"}
            </p>
            <p className="font-mono text-3xl font-bold text-gradient-electric leading-none">{result.reps}</p>
          </div>
        )}

        {result?.state && (
          <div className="absolute bottom-4 right-4 rounded-full glass px-3 py-1.5 text-xs">{result.state}</div>
        )}

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Cargando modelo Heavy…
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

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl glass p-5 shadow-card">
          <p className="text-xs uppercase tracking-widest text-primary">Análisis biomecánico</p>
          <h2 className="mt-1 text-2xl font-bold">{meta.label}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <ScoreTile label="Postura" value={result?.metrics.posture} />
            <ScoreTile label="Balance" value={result?.metrics.balance} />
            <ScoreTile label="Ejecución" value={result?.metrics.execution} />
            <ScoreTile label="Control" value={result?.metrics.control} />
          </div>

          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-primary">Nota final</p>
            <p className="mt-1 font-mono text-4xl font-bold text-gradient-electric">{result?.metrics.overall ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">/100</p>
          </div>
        </div>

        <div className="rounded-2xl glass p-5 shadow-card">
          <p className="text-xs uppercase tracking-widest text-primary">Coaching</p>
          <ul className="mt-3 space-y-2">
            {(result?.feedback ?? [{ ok: true, text: "Esperando datos…" }]).map((f, i) => (
              <li
                key={i}
                className={`rounded-xl border p-3 text-sm ${
                  f.ok
                    ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 text-foreground"
                    : "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 text-foreground"
                }`}
              >
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {result?.angles && (
          <div className="rounded-2xl glass p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-primary">Ángulos en vivo</p>
            <div className="mt-3 space-y-1.5 font-mono text-xs">
              {Object.entries(result.angles).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-foreground">{v.toFixed(0)}°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value?: number }) {
  const v = value ?? 0;
  const tone = v >= 80 ? "text-[hsl(var(--success))]" : v >= 60 ? "text-foreground" : "text-[hsl(var(--warning))]";
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${tone}`}>{value !== undefined ? value : "—"}</p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-gradient-electric transition-all" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
