import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { CheckCircle2, AlertTriangle, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "no-camera" | "ready";
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

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const KEY_LANDMARKS = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

export function PoseCalibration({ onCalibrated }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const stableFramesRef = useRef(0);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[]>([
    { id: "person", label: "Persona detectada", state: "bad", hint: "Colócate frente a la cámara" },
    { id: "frame", label: "Cuerpo completo en cuadro", state: "bad", hint: "Asegúrate de que se vean cabeza y tobillos" },
    { id: "distance", label: "Distancia ideal", state: "bad", hint: "Ajusta tu distancia a la cámara" },
    { id: "light", label: "Iluminación suficiente", state: "bad", hint: "Necesitas más luz en la escena" },
    { id: "centered", label: "Bien centrado", state: "bad", hint: "Muévete al centro del cuadro" },
  ]);
  const [message, setMessage] = useState("Preparando cámara…");
  const [readyPct, setReadyPct] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
        );
        const landmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
        loop();
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "No se pudo iniciar la cámara");
        setStatus("no-camera");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const ts = performance.now();
      const result = landmarker.detectForVideo(video, ts);
      drawAndEvaluate(result, video, canvas);
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  const drawAndEvaluate = (
    result: PoseLandmarkerResult,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
  ) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    // brightness check via downscaled draw
    const tmp = document.createElement("canvas");
    tmp.width = 32;
    tmp.height = 18;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(video, 0, 0, tmp.width, tmp.height);
    const pixels = tctx.getImageData(0, 0, tmp.width, tmp.height).data;
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    }
    const brightness = sum / (pixels.length / 4); // 0-255

    const lm = result.landmarks?.[0];
    const newChecks: Check[] = [
      { id: "person", label: "Persona detectada", state: "bad", hint: "Colócate frente a la cámara" },
      { id: "frame", label: "Cuerpo completo en cuadro", state: "bad", hint: "Asegúrate de que se vean cabeza y tobillos" },
      { id: "distance", label: "Distancia ideal", state: "bad", hint: "Ajusta tu distancia a la cámara" },
      { id: "light", label: "Iluminación suficiente", state: "bad", hint: "Necesitas más luz en la escena" },
      { id: "centered", label: "Bien centrado", state: "bad", hint: "Muévete al centro del cuadro" },
    ];

    // Light
    if (brightness > 110) newChecks[3] = { ...newChecks[3], state: "ok", hint: "Buena iluminación" };
    else if (brightness > 75) newChecks[3] = { ...newChecks[3], state: "warn", hint: "Más luz recomendada" };

    let msg = "Colócate frente a la cámara";

    if (lm && lm.length) {
      newChecks[0] = { ...newChecks[0], state: "ok", hint: "Detectado" };

      // draw skeleton
      drawSkeleton(ctx, lm, w, h);

      const nose = lm[KEY_LANDMARKS.nose];
      const lAnk = lm[KEY_LANDMARKS.leftAnkle];
      const rAnk = lm[KEY_LANDMARKS.rightAnkle];
      const lSh = lm[KEY_LANDMARKS.leftShoulder];
      const rSh = lm[KEY_LANDMARKS.rightShoulder];
      const lHip = lm[KEY_LANDMARKS.leftHip];
      const rHip = lm[KEY_LANDMARKS.rightHip];

      const inFrame = (p: any) =>
        p && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98 && (p.visibility ?? 1) > 0.5;

      const headOk = inFrame(nose);
      const feetOk = inFrame(lAnk) && inFrame(rAnk);
      const torsoOk = inFrame(lSh) && inFrame(rSh) && inFrame(lHip) && inFrame(rHip);

      if (headOk && feetOk && torsoOk) {
        newChecks[1] = { ...newChecks[1], state: "ok", hint: "Cuerpo completo" };
      } else if (torsoOk && (headOk || feetOk)) {
        newChecks[1] = { ...newChecks[1], state: "warn", hint: !feetOk ? "Aleja la cámara, no veo tus pies" : "Sube la cámara" };
        msg = !feetOk ? "Aleja la cámara para ver tus pies" : "Ajusta la cámara para ver tu cabeza";
      } else {
        msg = "Encuadra todo tu cuerpo";
      }

      // Distance via body height in frame (nose.y → ankle.y)
      if (nose && lAnk && rAnk) {
        const ankleY = Math.max(lAnk.y, rAnk.y);
        const bodyHeight = ankleY - nose.y; // 0-1
        if (bodyHeight > 0.95) {
          newChecks[2] = { ...newChecks[2], state: "warn", hint: "Aléjate un paso de la cámara" };
          msg = "Aléjate un paso de la cámara";
        } else if (bodyHeight < 0.45) {
          newChecks[2] = { ...newChecks[2], state: "warn", hint: "Acércate un paso a la cámara" };
          msg = "Acércate un paso a la cámara";
        } else if (bodyHeight >= 0.55 && bodyHeight <= 0.9) {
          newChecks[2] = { ...newChecks[2], state: "ok", hint: "Distancia perfecta" };
        } else {
          newChecks[2] = { ...newChecks[2], state: "warn", hint: "Casi en la distancia ideal" };
        }
      }

      // Centered: midpoint of hips
      if (lHip && rHip) {
        const cx = (lHip.x + rHip.x) / 2;
        const offset = Math.abs(cx - 0.5);
        if (offset < 0.08) newChecks[4] = { ...newChecks[4], state: "ok", hint: "Centrado" };
        else if (offset < 0.18) {
          newChecks[4] = { ...newChecks[4], state: "warn", hint: cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha" };
        } else {
          newChecks[4] = { ...newChecks[4], state: "bad", hint: cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha" };
          msg = cx < 0.5 ? "Muévete a tu izquierda" : "Muévete a tu derecha";
        }
      }
    } else {
      stableFramesRef.current = 0;
    }

    const okCount = newChecks.filter((c) => c.state === "ok").length;
    const pct = Math.round((okCount / newChecks.length) * 100);
    setReadyPct(pct);
    setChecks(newChecks);

    if (okCount === newChecks.length) {
      stableFramesRef.current += 1;
      setMessage("Listo para analizar");
      if (stableFramesRef.current > 30) {
        // Persisted ready state — surface to parent on demand
      }
    } else {
      stableFramesRef.current = 0;
      setMessage(msg);
    }
  };

  const allGood = checks.every((c) => c.state === "ok");

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[1fr_360px]">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-border">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100"
        />
        {/* framing guide */}
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-primary/40" />
        {/* status pill */}
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              allGood ? "bg-[hsl(var(--success))]" : "bg-primary animate-pulse-ring"
            }`}
          />
          {status === "loading"
            ? "Cargando IA…"
            : status === "no-camera"
            ? "Sin cámara"
            : message}
        </div>
        {/* readiness bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="glass rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Calibración</span>
              <span className="font-semibold text-foreground">{readyPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-electric transition-all"
                style={{ width: `${readyPct}%` }}
              />
            </div>
          </div>
        </div>

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Inicializando MediaPipe Pose…
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
            Asegúrate de cumplir todas las condiciones para un análisis preciso.
          </p>
        </div>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 transition-smooth"
            >
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

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31],
  [24, 26], [26, 28], [28, 32],
  [0, 11], [0, 12],
];

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number; visibility?: number }[],
  w: number,
  h: number,
) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
  ctx.shadowColor = "rgba(56, 189, 248, 0.7)";
  ctx.shadowBlur = 10;
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
  ctx.fillStyle = "rgb(59, 130, 246)";
  for (const p of lm) {
    if ((p.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
