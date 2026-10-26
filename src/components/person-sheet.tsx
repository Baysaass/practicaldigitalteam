"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, GradePill, StatusPill } from "@/components/pill";
import { Download, FileSpreadsheet, TrendingUp } from "lucide-react";
import type { View } from "@/lib/data";
import { METRICS, type PersonResult } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";

/** Right-hand detail panel for one person (opened from the dashboard and scorecard tables). */
export function PersonSheet({
  view,
  result,
  onClose,
}: {
  view: View;
  result: PersonResult | null;
  onClose: () => void;
}) {
  const r = result;
  const d = r ? view.details[r.person] ?? { recent: [], history: [] } : null;
  const note = r ? view.ratings[r.person]?.note : null;
  const b = view.benchmark;
  const scoreDiff = r && r.score != null && b.avgScore ? r.score - b.avgScore : null;

  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {r && d && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 text-lg">
                <Avatar name={r.person} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.person}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate">
                    {view.sprintName ? `${view.sprintName} · ` : ""}
                    {view.period} ({view.filter.from} — {view.filter.to})
                  </div>
                </div>
              </SheetTitle>
              <SheetDescription className="sr-only">
                {r.person} ажилтны ажлын дэлгэрэнгүй үзүүлэлт болон даалгаврын жагсаалт
              </SheetDescription>
              <div className="pt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => {
                    window.location.href = `/api/export-kpi?person=${encodeURIComponent(r.person)}&quarter=${view.period}`;
                  }}
                >
                  <FileSpreadsheet className="size-4" />
                  «{r.person}» KPI Excel тайлан татах (.xlsx)
                </Button>
              </div>
            </SheetHeader>
            <div className="space-y-5 p-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Нийт оноо</div>
                  <div className="text-3xl font-semibold tabular-nums">{r.score == null ? "—" : r.score.toFixed(1)}</div>
                  {b.avgScore && scoreDiff != null && (
                    <div className="mt-1 text-xs">
                      Багийн дундаж: {b.avgScore.toFixed(1)}{" "}
                      <span className={scoreDiff >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-red-600 dark:text-red-400"}>
                        ({scoreDiff >= 0 ? `+${scoreDiff.toFixed(1)}` : scoreDiff.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>
                <GradePill grade={r.grade} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Авсан" value={r.taken} />
                <Stat label="Хийсэн" value={r.done} />
                <Stat label="Хоцорсон" value={r.overdue} bad={r.overdue > 0} />
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold">Үзүүлэлтийн задаргаа</div>
                <div className="space-y-3">
                  {METRICS.map((m) => {
                    const v = r.sc[m.k];
                    return (
                      <div key={m.k}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>
                            {m.n} <span className="text-muted-foreground">· жин {view.weights[m.k]}%</span>
                          </span>
                          <span className="font-medium tabular-nums">{v == null ? "—" : v.toFixed(0)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${v ?? 0}%`, background: "var(--series-1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                <span>SPI (EV/PV)</span>
                <span className="text-right text-foreground tabular-nums">
                  {num(r.spi)} ({r.EV}/{r.PV})
                </span>
                <span>CPI</span>
                <span className="text-right text-foreground tabular-nums">{num(r.cpi)}</span>
                <span>Дахин нээгдсэн</span>
                <span className="text-right text-foreground tabular-nums">{r.reopened}</span>
                <span>Дундаж cycle time</span>
                <span className="text-right text-foreground tabular-nums">{num(r.cycle, 1)} өдөр</span>
              </div>
              {d.history.length > 1 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Sprint бүрийн оноо</div>
                  <div className="flex h-24 items-end gap-1.5">
                    {d.history.map((h) => (
                      <div key={h.name} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${h.name}: ${h.score == null ? "—" : h.score.toFixed(1)}`}>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{h.score == null ? "" : h.score.toFixed(0)}</span>
                        <div className="w-full rounded-t" style={{ height: `${Math.max(4, (h.score ?? 0) * 0.6)}px`, background: "var(--series-1)" }} />
                        <span className="w-full truncate text-center text-[10px] text-muted-foreground">{h.name.replace(/^.*?(\d+)\s*$/, "S$1")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {note && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Удирдлагын тайлбар</div>
                  {note}
                </div>
              )}
              <div>
                <div className="mb-2 text-sm font-semibold">Task-ууд</div>
                <div className="divide-y rounded-lg border">
                  {d.recent.length ? (
                    d.recent.map((t) => {
                      const isSubtask = !!t.parentKey || t.type?.toLowerCase() === "sub-task" || !!t.parentSummary;
                      const parentTitle = t.parentSummary || t.parentKey;
                      return (
                        <div key={t.key} className="flex flex-col gap-1.5 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 font-mono text-xs font-semibold text-primary">{t.key}</span>
                            <span className="flex-1 truncate text-sm font-medium">{t.summary}</span>
                            <StatusPill status={t.status} done={t.done} late={t.late} />
                          </div>
                          {isSubtask && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80">Дэд ажил</span>
                              {parentTitle && <span className="truncate">Төсөл: {parentTitle}</span>}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            {t.type && <span>Төрөл: {t.type}</span>}
                            {t.storyPoints != null && <span>SP: {t.storyPoints}</span>}
                            {t.started && <span>Эхэлсэн: {t.started}</span>}
                            {t.due && <span>Хугацаа: {t.due}</span>}
                            {t.resolved && <span className="text-emerald-600 dark:text-emerald-400">Дууссан: {t.resolved}</span>}
                            {t.reopens > 0 && <span className="text-amber-600 dark:text-amber-400">Дахин нээгдсэн: {t.reopens}</span>}
                          </div>
                          {t.description && (
                            <div className="rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground line-clamp-2">
                              {t.description}
                            </div>
                          )}
                          {t.resolutionNotes && (
                            <div className="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400 line-clamp-2">
                              {t.resolutionNotes}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">Энэ хугацаанд task байхгүй байна</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums", bad && "text-red-700 dark:text-red-400")}>{value}</div>
    </div>
  );
}
