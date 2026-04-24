import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChatBubble } from "@/components/ChatBubble";
import { ConsultationsList } from "@/components/ConsultationsList";
import { Heart, Send, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "¡Hola! Soy MediBot 💚\n\nPuedo ayudarte a guardar tus consultas médicas. Cuéntame, por ejemplo:\n\n• «Ayer fui al cardiólogo Dr. López, me dijo que tengo la presión un poco alta»\n• «Muéstrame mis últimas consultas»",
};

const Index = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("medical-chat", {
        body: {
          messages: next.filter((m, i) => !(i === 0 && m === WELCOME)).map(
            (m) => ({ role: m.role, content: m.content }),
          ),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply ?? "Hecho.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message ?? "No pude responder ahora mismo");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Lo siento, tuve un problema. ¿Puedes intentarlo de nuevo?",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (!authChecked) return null;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 bg-card/70 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-warm shadow-bubble">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">MediBot</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Tu historial, en buenas manos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ver historial">
                <FileText className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md p-0 overflow-y-auto">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Mi historial médico</SheetTitle>
              </SheetHeader>
              <ConsultationsList refreshKey={refreshKey} />
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 pl-10 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
              <span
                className="h-2 w-2 rounded-full bg-primary animate-pulse-dot"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="h-2 w-2 rounded-full bg-primary animate-pulse-dot"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/70 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Cuéntame sobre tu consulta..."
            className="rounded-full bg-background"
            disabled={sending}
          />
          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-warm shadow-bubble hover:opacity-95"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
          MediBot no sustituye consejo médico profesional.
        </p>
      </div>
    </div>
  );
};

export default Index;
