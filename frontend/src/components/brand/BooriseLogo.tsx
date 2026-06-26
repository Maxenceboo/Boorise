import { cn } from "@/lib/utils";

export function BooriseMark({ className }: { className?: string }) {
  return (
    <img
      className={cn("brand-mark boorise-mark", className)}
      src="/brand/boorise-logo-mark.svg"
      alt=""
      aria-hidden="true"
    />
  );
}
