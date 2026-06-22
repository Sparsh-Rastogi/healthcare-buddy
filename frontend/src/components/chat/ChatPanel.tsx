import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatCompletion, GroqError, getApiKey } from "@/lib/groq";
import { chatApi } from "@/lib/baymax-api";
import { KEYS, readLS } from "@/lib/storage";
import type { ChatMessage, TrackerSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrackerSuggestionCard } from "@/components/chat/TrackerSuggestionCard";

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

  const [sessionId, setSessionId] = useState<string | undefined>();

  /**
   * Extract <!--SUGGEST_TRACKERS:[...]-->  from an assistant reply.
   * Returns the clean display text and the parsed suggestions array.
   */
  function parseSuggestions(text: string): {
    cleanText: string;
    suggestions: TrackerSuggestion[];
  } {
    const match = text.match(/<!--SUGGEST_TRACKERS:(\[.*?\])-->/s);
    if (!match) return { cleanText: text, suggestions: [] };
    try {
      const suggestions: TrackerSuggestion[] = JSON.parse(match[1]);
      const cleanText = text.replace(match[0], "").trim();
      return { cleanText, suggestions };
    } catch {
      // Malformed JSON from LLM — just strip the block
      return { cleanText: text.replace(match[0], "").trim(), suggestions: [] };
    }
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);

    const token = readLS<string>(KEYS.authToken, "");
    if (!token && !getApiKey()) {
      setError("Sign in and run the backend, or add a Groq API key in Settings.");
      return;
    }

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      if (token) {
        try {
          const res = await chatApi.message({ message: text, session_id: sessionId });
          setSessionId(res.session_id);
          const { cleanText, suggestions } = parseSuggestions(res.baymax_response);
          setMessages((m) => [...m, { role: "assistant", content: cleanText, suggestions }]);
          onAssistant?.(cleanText);
          return;
        } catch {
          if (!getApiKey()) throw new Error("Backend unavailable and no Groq key configured.");
        }
      }

      const reply = await chatCompletion({
        messages: [{ role: "system", content: systemPrompt }, ...next],
      });
      const { cleanText, suggestions } = parseSuggestions(reply);
      setMessages((m) => [...m, { role: "assistant", content: cleanText, suggestions }]);
      onAssistant?.(cleanText);
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
              "flex flex-col gap-1",
              m.role === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
            {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 && (
              <div className="w-[85%]">
                <TrackerSuggestionCard suggestions={m.suggestions} />
              </div>
            )}
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
