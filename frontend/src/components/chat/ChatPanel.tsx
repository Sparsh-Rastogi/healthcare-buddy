import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatCompletion, GroqError, getApiKey } from "@/lib/groq";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  systemPrompt: string;
  initialAssistantMessage?: string;
  onAssistant?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatPanel({
  systemPrompt,
  initialAssistantMessage,
  onAssistant,
  disabled,
  placeholder = "Type a message…",
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialAssistantMessage ? [{ role: "assistant", content: initialAssistantMessage }] : [],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    if (!getApiKey()) {
      setError("Add your Groq API key in Settings to use chat.");
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await chatCompletion({
        messages: [{ role: "system", content: systemPrompt }, ...next],
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      onAssistant?.(reply);
    } catch (e) {
      setError(e instanceof GroqError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ask me about your symptoms, meds, or general wellness.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="bg-muted rounded-2xl px-3.5 py-2.5 text-sm inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
      </div>
      {error && (
        <div className="px-4 pb-2 text-xs text-destructive">{error}</div>
      )}
      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || loading}
          className="resize-none min-h-[44px] max-h-32"
        />
        <Button onClick={send} disabled={disabled || loading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
