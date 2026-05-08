import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PoseCalibration } from "@/components/coach/PoseCalibration";
import { Activity, Dumbbell, Sparkles, Target, Zap } from "lucide-react";
import { toast } from "sonner";

type Stage = "landing" | "calibrate" | "analyze";

const Index = () => {
  const [stage, setStage] = useState<Stage>("landing");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-electric shadow-glow">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">AI Sports Coach</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Pro precision
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground sm:inline-block">
          MediaPipe Pose · Real-time
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
                Detección corporal en tiempo real con IA. Sentadillas, boxeo y patinaje
                evaluados como lo haría un entrenador real.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setStage("calibrate")}
                  className="h-12 bg-gradient-electric px-7 text-base font-semibold text-primary-foreground shadow-glow"
                >
                  Iniciar calibración
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => toast.info("Disponible muy pronto")}
                  className="h-12 px-7"
                >
                  Ver disciplinas
                </Button>
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-3">
              {[
                { icon: Activity, title: "Tracking estable", desc: "33 puntos clave con suavizado y baja latencia." },
                { icon: Target, title: "Ángulos reales", desc: "Análisis biomecánico de rodillas, cadera y espalda." },
                { icon: Dumbbell, title: "Multi-deporte", desc: "Boxeo, sentadillas y patinaje con métricas dedicadas." },
              ].map((f, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card/60 p-5 shadow-card transition-smooth hover:border-primary/40"
                >
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

        {stage === "calibrate" && (
          <section className="animate-fade-up mt-2">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary">Paso 1 de 2</p>
                <h2 className="mt-1 text-3xl font-bold">Calibración automática</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Permite el acceso a la cámara y sigue las indicaciones. Cuando todo esté en
                  verde verás “Listo para analizar”.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setStage("landing")}>
                ← Volver
              </Button>
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
          <section className="animate-fade-up mt-10 text-center">
            <h2 className="text-3xl font-bold">¡Listo para analizar!</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              El módulo de análisis por disciplina (boxeo, sentadillas, patinaje) llega en el
              próximo paso.
            </p>
            <Button
              className="mt-6 bg-gradient-electric text-primary-foreground shadow-glow"
              onClick={() => setStage("calibrate")}
            >
              Volver a calibración
            </Button>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
