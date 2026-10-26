"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Filter } from "@/lib/data";
import { cn } from "@/lib/utils";

const field = "h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30";

/** Sprint / date range / person filters, kept in the URL so views can be shared. */
export function Filters({
  filter,
  sprints,
  people,
  today,
}: {
  filter: Filter;
  sprints: { id: number; name: string; state: string | null }[];
  people: string[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    start(() => router.replace(`${pathname}?${p}`, { scroll: false }));
  };
  const quarterStart = `${today.slice(0, 5)}${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  const sprintMode = filter.sprintId != null;

  return (
    <div className={cn("flex flex-wrap items-end gap-2 print:hidden", pending && "opacity-70")}>
      <Labeled label="Sprint">
        <select className={cn(field, "max-w-[220px] pr-7")} value={filter.sprintId ?? ""} onChange={(e) => set({ sprint: e.target.value || null })}>
          <option value="">Бүх sprint (огноогоор)</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.state === "active" ? " · идэвхтэй" : ""}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Улирал">
        <select
          className={cn(field, "pr-7")}
          value={filter.quarter || ""}
          onChange={(e) => {
            const q = e.target.value;
            if (q) {
              set({ sprint: null, quarter: q, from: null, to: null });
            } else {
              set({ quarter: null });
            }
          }}
        >
          <option value="">Огноогоор</option>
          {["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2025-Q4", "2025-Q3"].map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Эхлэх">
        <input type="date" className={field} value={filter.from} disabled={sprintMode} onChange={(e) => set({ quarter: null, from: e.target.value })} />
      </Labeled>
      <Labeled label="Дуусах">
        <input type="date" className={field} value={filter.to} disabled={sprintMode} onChange={(e) => set({ quarter: null, to: e.target.value })} />
      </Labeled>
      <Labeled label="Ажилтан">
        <select className={cn(field, "pr-7")} value={filter.person ?? ""} onChange={(e) => set({ person: e.target.value || null })}>
          <option value="">Бүгд</option>
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Labeled>
      <Button variant="outline" onClick={() => set({ sprint: null, from: `${today.slice(0, 8)}01`, to: today })}>
        Энэ сар
      </Button>
      <Button variant="outline" className="hidden lg:inline-flex" onClick={() => set({ sprint: null, from: quarterStart, to: today })}>
        Улирал
      </Button>
      <Button variant="outline" size="icon" aria-label="Хэвлэх" icon={<Printer className="size-4" />} onClick={() => window.print()} />
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
