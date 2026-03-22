import { cn } from "@/lib/cn";
import type { StudyGapColour } from "@/lib/study-gap";

type Props = {
  colour: StudyGapColour;
  size?: "sm" | "md";
  className?: string;
};

const COLOUR_CLASS: Record<StudyGapColour, string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-500",
  RED: "bg-red-500",
};

export default function StudyGapIndicator({ colour, size = "sm", className }: Props) {
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  const textSize = size === "md" ? "text-xs" : "text-[11px]";

  return (
    <span className={cn("inline-flex items-center gap-1 text-slate-500", textSize, className)}>
      <span className={cn("inline-block rounded-full", dotSize, COLOUR_CLASS[colour])} />
      <span>(Indicator)</span>
    </span>
  );
}
