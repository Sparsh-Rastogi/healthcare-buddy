import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BAYMAX_CHAT_PROMPT } from "@/lib/brand";

export function ChatFAB() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="no-print fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full soft-shadow bg-gradient-to-br from-primary to-sky-500/90 hover:from-primary/90 hover:to-sky-500/80 text-primary-foreground"
        aria-label="Chat with Baymax"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b bg-gradient-to-r from-primary/5 to-sky-50/50">
            <SheetTitle className="flex items-center gap-2">
              <span className="text-lg">💙</span> Chat with Baymax
            </SheetTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Ask about your logs, trends, or general health questions.
            </p>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatPanel
              systemPrompt={BAYMAX_CHAT_PROMPT}
              initialAssistantMessage="Hi there! I'm Baymax, your health companion. How can I help you today?"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
