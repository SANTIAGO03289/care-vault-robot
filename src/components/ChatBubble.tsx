import { cn } from "@/lib/utils";
import { Heart, User } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export const ChatBubble = ({ role, content }: Props) => {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex items-end gap-2 animate-fade-up",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-warm shadow-bubble">
          <Heart className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-bubble whitespace-pre-wrap",
          isUser
            ? "bg-gradient-bubble text-primary-foreground rounded-br-md"
            : "bg-card text-card-foreground rounded-bl-md border border-border/50",
        )}
      >
        {content}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
