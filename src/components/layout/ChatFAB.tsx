import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatPanel } from "@/components/chat/ChatPanel";

export function ChatFAB() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="no-print fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full soft-shadow"
        aria-label="Open AI chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Chat with Health Buddy</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatPanel
              systemPrompt="You are Health Buddy, a calm, supportive health-info assistant. Be brief, kind, and never give diagnoses or prescriptions. Suggest seeing a clinician for medical decisions."
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
