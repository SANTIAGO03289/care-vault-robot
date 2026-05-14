import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { LandmarkSmoother, type Pt } from "@/lib/oneEuroFilter";

const POSE_HEAVY =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";
const POSE_FULL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

type Status = "loading" | "no-camera" | "ready";

export interface UsePoseOptions {
  onFrame?: (lm: Pt[] | null, raw: PoseLandmarkerResult, video: HTMLVideoElement) => void;
  model?: "heavy" | "full";
  minCutoff?: number;
  beta?: number;
}

export function usePose(videoRef: React.RefObject<HTMLVideoElement>, opts: UsePoseOptions = {}) {
  const { onFrame, model = "heavy", minCutoff = 1.4, beta = 0.04 } = opts;
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(-1);
  const smootherRef = useRef(new LandmarkSmoother(minCutoff, beta));
  const fpsRef = useRef({ frames: 0, last: performance.now(), value: 0 });
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
        );
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: model === "heavy" ? POSE_HEAVY : POSE_FULL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
          outputSegmentationMasks: false,
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
            frameRate: { ideal: 60 },
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

    const loop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastTimeRef.current) {
        lastTimeRef.current = video.currentTime;
        const ts = performance.now();
        try {
          const result = landmarker.detectForVideo(video, ts);
          const raw = result.landmarks?.[0] as Pt[] | undefined;
          const smoothed = raw ? smootherRef.current.smooth(raw, ts) : null;
          if (!raw) smootherRef.current.reset();
          callbackRef.current?.(smoothed, result, video);

          // fps
          const f = fpsRef.current;
          f.frames += 1;
          if (ts - f.last >= 500) {
            f.value = Math.round((f.frames * 1000) / (ts - f.last));
            f.frames = 0;
            f.last = ts;
            setFps(f.value);
          }
        } catch (e) {
          console.error("pose detect error", e);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  return { status, error, fps };
}
