import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Stethoscope, FileText, Download } from "lucide-react";
import { exportConsultationsToPdf } from "@/lib/exportPdf";
import { toast } from "sonner";

interface Consultation {
  id: string;
  consultation_date: string | null;
  doctor_name: string | null;
  specialty: string | null;
  reason: string | null;
  diagnosis: string | null;
  notes: string | null;
  created_at: string;
}

export const ConsultationsList = ({ refreshKey }: { refreshKey: number }) => {
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("consultation_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) {
        setItems((data as Consultation[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleExport = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      let patientName: string | undefined;
      if (userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user.id)
          .maybeSingle();
        patientName =
          profile?.full_name?.trim() || userData.user.email || undefined;
      }
      exportConsultationsToPdf(items, patientName);
      toast.success("PDF descargado");
    } catch (err: any) {
      toast.error("No se pudo generar el PDF");
    }
  };

  const ExportButton = (
    <div className="px-4 pt-4">
      <Button
        onClick={handleExport}
        disabled={items.length === 0}
        className="w-full bg-gradient-warm shadow-bubble hover:opacity-95"
      >
        <Download className="mr-2 h-4 w-4" />
        Exportar como PDF
      </Button>
    </div>
  );

  if (loading)
    return (
      <p className="text-sm text-muted-foreground p-4">Cargando historial...</p>
    );

  if (items.length === 0)
    return (
      <>
        {ExportButton}
        <div className="p-6 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Aún no hay consultas guardadas. Cuéntale a MediBot sobre tu última
            visita médica.
          </p>
        </div>
      </>
    );

  return (
    <div className="space-y-3 p-4">
      {items.map((c) => (
        <Card
          key={c.id}
          className="p-4 shadow-soft border-border/50 transition-smooth hover:shadow-bubble"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Stethoscope className="h-4 w-4" />
              {c.specialty || "Consulta"}
            </div>
            {c.consultation_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(c.consultation_date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
          {c.doctor_name && (
            <p className="text-sm font-medium">{c.doctor_name}</p>
          )}
          {c.reason && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">Motivo: </span>
              {c.reason}
            </p>
          )}
          {c.diagnosis && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">Diagnóstico: </span>
              {c.diagnosis}
            </p>
          )}
          {c.notes && (
            <p className="text-sm mt-1 text-muted-foreground italic">
              {c.notes}
            </p>
          )}
        </Card>
      ))}
      </div>
    </>
  );
};
