import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PoseCalibration } from "@/components/coach/PoseCalibration";
import { PoseAnalyzer } from "@/components/coach/PoseAnalyzer";
import { Activity, Dumbbell, Sparkles, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import type { SportKey } from "@/lib/biomechanics";

type Stage = "landing" | "sport" | "calibrate" | "analyze";

const SPORTS: { id: SportKey; label: string; desc: string; icon: typeof Activity }[] = [
  { id: "squat", label: "Sentadillas", desc: "Profundidad, simetría y espalda neutra.", icon: Dumbbell },
  { id: "boxing", label: "Boxeo", desc: "Jab, cross, guardia y transferencia de peso.", icon: Target },
  { id: "skating", label: "Patinaje", desc: "Inclinación, balance y postura aerodinámica.", icon: Activity },
];

const Index = () => {
  const [stage, setStage] = useState<Stage>("landing");
  const [sport, setSport] = useState<SportKey>("squat");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-electric shadow-glow">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">AI Sports Coach</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pro precision</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground sm:inline-block">
          MediaPipe Heavy · One Euro · Real-time
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        {stage === "landing" && (
          <section className="animate-fade-up">
            <div className="mx-auto mt-6 max-w-3xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Análisis biomecánico en vivo
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-6xl">
                Tu técnica deportiva,{" "}
                <span className="text-gradient-electric">analizada con precisión profesional</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Modelo Heavy de MediaPipe Pose con suavizado One Euro. 33 puntos clave, ángulos
                articulares reales y puntuación técnica como la de un entrenador profesional.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setStage("sport")}
                  className="h-12 bg-gradient-electric px-7 text-base font-semibold text-primary-foreground shadow-glow"
                >
                  Comenzar análisis
                </Button>
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-3">
              {[
                { icon: Activity, title: "Tracking estable", desc: "33 puntos con One Euro Filter, sin saltos ni jitter." },
                { icon: Target, title: "Ángulos reales", desc: "Rodilla, cadera, codo y espalda en grados, frame a frame." },
                { icon: Dumbbell, title: "Multi-deporte", desc: "Boxeo, sentadillas y patinaje con métricas dedicadas." },
              ].map((f, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card/60 p-5 shadow-card transition-smooth hover:border-primary/40">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-electric text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {stage === "sport" && (
          <section className="animate-fade-up mt-2">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">Paso 1 de 3</p>
                <h2 className="mt-1 text-3xl font-bold">Elige tu disciplina</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Cada deporte usa métricas y ángulos biomecánicos específicos.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setStage("landing")}>← Volver</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {SPORTS.map((s) => {
                const active = sport === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSport(s.id)}
                    className={`text-left rounded-2xl border p-5 transition-smooth shadow-card ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-card/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-electric text-primary-foreground">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{s.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                size="lg"
                onClick={() => setStage("calibrate")}
                className="h-12 bg-gradient-electric px-7 text-base font-semibold text-primary-foreground shadow-glow"
              >
                Continuar → Calibración
              </Button>
            </div>
          </section>
        )}

        {stage === "calibrate" && (
          <section className="animate-fade-up mt-2">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">Paso 2 de 3</p>
                <h2 className="mt-1 text-3xl font-bold">Calibración automática</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Permite el acceso a la cámara y sigue las indicaciones. Cuando todo esté en
                  verde verás “Listo para analizar”.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setStage("sport")}>← Cambiar deporte</Button>
            </div>
            <PoseCalibration
              onCalibrated={() => {
                toast.success("Calibración completada");
                setStage("analyze");
              }}
            />
          </section>
        )}

        {stage === "analyze" && (
          <section className="animate-fade-up mt-2">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">Paso 3 de 3</p>
                <h2 className="mt-1 text-3xl font-bold">Análisis en vivo</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Métricas, ángulos y feedback técnico en tiempo real.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setStage("calibrate")}>← Recalibrar</Button>
            </div>
            <PoseAnalyzer sport={sport} />
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
