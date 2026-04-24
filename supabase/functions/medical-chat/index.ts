import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres MediBot, un asistente de salud cálido y empático que ayuda al usuario a registrar y consultar su historial médico personal (consultas, diagnósticos, médicos, especialidades, notas).

REGLAS:
- Habla en español, tono cercano y amable, frases cortas.
- NO das diagnósticos ni consejos médicos. Si el usuario pide diagnóstico, recomiéndale consultar con un profesional.
- Cuando el usuario te cuente sobre una consulta médica que ya tuvo, EXTRAE los datos y llama a la herramienta save_consultation. Pregunta por datos faltantes importantes (fecha, médico, motivo) si no los menciona.
- Cuando pregunte por su historial, llama a list_consultations.
- Tras guardar, confirma brevemente lo guardado.
- Hoy es ${new Date().toISOString().split("T")[0]}.`;

const tools = [
  {
    type: "function",
    function: {
      name: "save_consultation",
      description:
        "Guarda una consulta médica del usuario en su historial personal.",
      parameters: {
        type: "object",
        properties: {
          consultation_date: {
            type: "string",
            description: "Fecha de la consulta en formato YYYY-MM-DD",
          },
          doctor_name: { type: "string", description: "Nombre del médico" },
          specialty: {
            type: "string",
            description: "Especialidad (ej. Cardiología, Medicina general)",
          },
          reason: { type: "string", description: "Motivo de la consulta" },
          diagnosis: { type: "string", description: "Diagnóstico recibido" },
          notes: {
            type: "string",
            description: "Notas adicionales, indicaciones, tratamiento",
          },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_consultations",
      description:
        "Devuelve las consultas médicas del usuario, ordenadas por fecha descendente.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo a devolver (1-50)" },
        },
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user)
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const userId = userData.user.id;

    const { messages } = await req.json();

    // Loop: allow up to 3 tool round-trips
    const convo = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    for (let i = 0; i < 4; i++) {
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: convo,
            tools,
          }),
        },
      );

      if (aiResp.status === 429)
        return new Response(
          JSON.stringify({
            error:
              "Has alcanzado el límite de mensajes. Intenta de nuevo en un momento.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      if (aiResp.status === 402)
        return new Response(
          JSON.stringify({
            error:
              "Se agotaron los créditos de IA. Añade crédito en tu workspace de Lovable.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      if (!aiResp.ok) {
        const txt = await aiResp.text();
        console.error("AI error", aiResp.status, txt);
        throw new Error("Error en el servicio de IA");
      }

      const data = await aiResp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("Respuesta vacía");

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return new Response(
          JSON.stringify({ reply: msg.content ?? "" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      convo.push(msg);

      for (const tc of toolCalls) {
        const fname = tc.function.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {}

        let result: any = {};
        if (fname === "save_consultation") {
          const insertRow = {
            user_id: userId,
            consultation_date: args.consultation_date || null,
            doctor_name: args.doctor_name || null,
            specialty: args.specialty || null,
            reason: args.reason || null,
            diagnosis: args.diagnosis || null,
            notes: args.notes || null,
          };
          const { data: ins, error } = await supabase
            .from("consultations")
            .insert(insertRow)
            .select()
            .single();
          result = error ? { error: error.message } : { ok: true, consultation: ins };
        } else if (fname === "list_consultations") {
          const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);
          const { data: rows, error } = await supabase
            .from("consultations")
            .select("*")
            .order("consultation_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(limit);
          result = error ? { error: error.message } : { consultations: rows };
        } else {
          result = { error: "Tool desconocida" };
        }

        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({
        reply:
          "He registrado tu información, pero no puedo seguir procesando ahora mismo.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("medical-chat error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
