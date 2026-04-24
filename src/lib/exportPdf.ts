import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Consultation {
  consultation_date: string | null;
  doctor_name: string | null;
  specialty: string | null;
  reason: string | null;
  diagnosis: string | null;
  notes: string | null;
  created_at: string;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

export const exportConsultationsToPdf = (
  items: Consultation[],
  patientName?: string,
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(64, 153, 116); // primary green
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MediBot", 40, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Historial médico personal", 40, 55);

  // Meta
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  let y = 95;
  if (patientName) {
    doc.setFont("helvetica", "bold");
    doc.text(`Paciente: ${patientName}`, 40, y);
    y += 14;
  }
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el ${today}`, 40, y);
  doc.text(`Total de consultas: ${items.length}`, 40, y + 14);

  if (items.length === 0) {
    doc.setFontSize(12);
    doc.text("Aún no hay consultas registradas.", 40, y + 50);
  } else {
    autoTable(doc, {
      startY: y + 30,
      head: [["Fecha", "Especialidad", "Médico", "Motivo", "Diagnóstico", "Notas"]],
      body: items.map((c) => [
        fmtDate(c.consultation_date),
        c.specialty ?? "—",
        c.doctor_name ?? "—",
        c.reason ?? "—",
        c.diagnosis ?? "—",
        c.notes ?? "—",
      ]),
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 6,
        valign: "top",
        textColor: [40, 40, 40],
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [64, 153, 116],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 250, 247] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 75 },
        2: { cellWidth: 85 },
      },
      margin: { left: 30, right: 30 },
    });
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Documento generado por MediBot · No sustituye consejo médico profesional",
      pageWidth / 2,
      h - 20,
      { align: "center" },
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, h - 20, {
      align: "right",
    });
  }

  const filename = `historial-medico-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};
