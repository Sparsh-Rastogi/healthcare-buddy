import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

interface Props {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: "h-4 w-4", box: "w-8 h-8", text: "text-base" },
  md: { icon: "h-5 w-5", box: "w-10 h-10", text: "text-lg" },
  lg: { icon: "h-7 w-7", box: "w-14 h-14", text: "text-2xl" },
};

export function BaymaxLogo({ size = "sm", showName = true, className }: Props) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-sky-200/40 text-primary soft-shadow",
          s.box,
        )}
      >
        <Bot className={s.icon} aria-hidden />
      </span>
      {showName && (
        <span className={cn("font-semibold tracking-tight text-foreground", s.text)}>{APP_NAME}</span>
      )}
    </div>
  );
}
