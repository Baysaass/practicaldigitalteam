import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/metrics";
import { initials } from "@/lib/format";

const TONES = {
  green: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  gray: "bg-muted text-muted-foreground",
} as const;
export type Tone = keyof typeof TONES;

/** ERPNext-style indicator pill: colored dot + label. */
export function Pill({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export function GradePill({ grade, className }: { grade: Grade | null; className?: string }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  return (
    <Pill tone={grade.tone} className={className}>
      {grade.g} · {grade.n}
    </Pill>
  );
}

export function StatusPill({ status, done, late }: { status: string; done: boolean; late: boolean }) {
  if (done) return <Pill tone="green">{status}</Pill>;
  if (late) return <Pill tone="red">{status} · хоцорсон</Pill>;
  if (/progress|хийгдэж|review/i.test(status)) return <Pill tone="blue">{status}</Pill>;
  return <Pill tone="orange">{status}</Pill>;
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-secondary font-semibold",
        size === "sm" ? "size-6 text-[10px]" : "size-9 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}
