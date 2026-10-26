"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Lock, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, GradePill, Pill } from "@/components/pill";
import { PersonSheet } from "@/components/person-sheet";
import { DownloadKpiDialog } from "@/components/download-kpi-dialog";
import type { View } from "@/lib/data";
import { METRICS, QUAL, type PersonResult, type Weights } from "@/lib/metrics";
import { num, pct, tone } from "@/lib/format";

export function Evaluation({ view }: { view: View }) {
  const [open, setOpen] = useState<PersonResult | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<string | null>(null);
  const ranked = [...view.results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="space-y-5">
      {/* Read-Only Notice with /zaki Management Link */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted bg-muted/30 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          <span>
            Энэхүү хуудас нь <strong>зөвхөн харах</strong> (Read-only) горимтой. Ажилтан бүр өөрийн болон багийн оноог харах боломжтой.
          </span>
        </div>
        <Link href="/zaki">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <Lock className="size-3 text-primary" />
            Удирдлага нэвтрэх (/zaki)
            <ExternalLink className="size-3 opacity-60" />
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Онооны карт</CardTitle>
          <CardDescription>
            Тоон үзүүлэлт Jira-аас автоматаар, чанарын үзүүлэлтийг удирдлага /zaki-аас баталгаажуулна. Мөрөн дээр дарж дэлгэрэнгүйг харна.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="print:hidden"
              onClick={() => {
                const target = ranked[0]?.person;
                if (target) {
                  setDownloadTarget(target);
                }
              }}
            >
              <FileSpreadsheet className="size-4" />
              KPI Excel татах
            </Button>
            <Button variant="outline" size="sm" className="print:hidden" onClick={() => exportCsv(view)}>
              <Download className="size-3.5" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Ажилтан</TableHead>
                  <TableHead className="text-right">Авсан</TableHead>
                  <TableHead className="text-right">Хийсэн</TableHead>
                  <TableHead className="text-right">Гүйцэтгэл</TableHead>
                  <TableHead className="text-right">Хугацаандаа</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                  <TableHead className="text-right">CPI</TableHead>
                  <TableHead className="text-right">Чанар</TableHead>
                  <TableHead className="text-right">Удирдлага</TableHead>
                  <TableHead className="text-right">Нийт оноо</TableHead>
                  <TableHead>Зэрэглэл</TableHead>
                  <th className="py-2.5 pl-2 pr-4 text-right">KPI Excel</th>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {ranked.map((r, i) => (
                  <TableRow key={r.person} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(r)}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.person} />
                        <span className="font-medium">{r.person}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{r.taken}</TableCell>
                    <TableCell className="text-right">{r.done}</TableCell>
                    <TableCell className={`text-right ${tone(r.completion, 0.85, 0.7)}`}>{pct(r.completion)}</TableCell>
                    <TableCell className={`text-right ${tone(r.ontime, 0.85, 0.7)}`}>{pct(r.ontime)}</TableCell>
                    <TableCell className={`text-right ${tone(r.spi, 0.95, 0.8)}`}>{num(r.spi)}</TableCell>
                    <TableCell className={`text-right ${tone(r.cpi, 0.95, 0.8)}`}>{num(r.cpi)}</TableCell>
                    <TableCell className={`text-right ${tone(r.quality, 0.9, 0.8)}`}>{pct(r.quality)}</TableCell>
                    <TableCell className="text-right">
                      {r.qualAvg == null ? <Pill tone="orange">Бөглөөгүй</Pill> : `${r.qualAvg.toFixed(1)} / 5`}
                    </TableCell>
                    <TableCell className="text-right text-base font-bold">{r.score == null ? "—" : r.score.toFixed(1)}</TableCell>
                    <TableCell>
                      <GradePill grade={r.grade} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-normal"
                        onClick={() => {
                          setDownloadTarget(r.person);
                        }}
                      >
                        <Download className="size-3.5" />
                        Excel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Qualitative Ratings Overview */}
      <ReadOnlyRatings view={view} />

      {/* Read-Only Weights Summary */}
      <ReadOnlyWeights weights={view.weights} />

      <PersonSheet view={view} result={open} onClose={() => setOpen(null)} />

      <DownloadKpiDialog
        open={!!downloadTarget}
        person={downloadTarget}
        period={view.period}
        onClose={() => setDownloadTarget(null)}
      />
    </div>
  );
}

function ReadOnlyRatings({ view }: { view: View }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Удирдлагын чанарын үнэлгээний тойм · {view.period}
        </CardTitle>
        <CardDescription>
          Удирдлагын өгсөн чанарын үнэлгээ (1–5 оноо) болон зөвлөмжүүд. (Үнэлгээ оруулах/засах эрх: /zaki)
        </CardDescription>
        <CardAction>
          <Link href="/zaki">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Lock className="size-3.5" />
              Үнэлгээ засах (/zaki)
            </Button>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-48">Ажилтан</TableHead>
                {QUAL.map(([, n]) => (
                  <TableHead key={n} className="text-center">{n}</TableHead>
                ))}
                <TableHead className="text-center">Дундаж</TableHead>
                <TableHead className="min-w-[280px]">Удирдлагын тайлбар / санал</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.results.map(({ person, qualAvg }) => {
                const q = view.ratings[person];
                return (
                  <TableRow key={`${person}-${view.period}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar name={person} />
                        <span className="font-medium">{person}</span>
                      </div>
                    </TableCell>
                    {QUAL.map(([k]) => {
                      const val = q?.[k];
                      return (
                        <TableCell key={k} className="text-center font-medium">
                          {val ? (
                            <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                              {val}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-semibold tabular-nums">
                      {qualAvg == null ? <Pill tone="orange">Бөглөөгүй</Pill> : `${qualAvg.toFixed(1)} / 5`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q?.note ? <span className="text-foreground">{q.note}</span> : <span className="italic">Тайлбар оруулаагүй</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadOnlyWeights({ weights }: { weights: Weights }) {
  const total = METRICS.reduce((a, m) => a + (Number(weights[m.k]) || 0), 0);
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Үзүүлэлтийн батлагдсан жин</CardTitle>
        <CardDescription>Нийт оноог тооцоход ашиглаж буй үзүүлэлтүүдийн хувийн жин.</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Pill tone={total === 100 ? "green" : "orange"}>{total}%</Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((m) => (
          <div key={m.k} className="rounded-lg border bg-muted/20 p-2.5 text-center">
            <div className="text-xs text-muted-foreground">{m.n}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{weights[m.k]}%</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function exportCsv(view: View) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = [
    "Ажилтан", "Авсан", "Хийсэн", "Гүйцэтгэл %", "Хугацаандаа %", "SPI", "CPI", "Чанар %",
    "Хоцорсон", "Cycle өдөр", ...QUAL.map(([, n]) => n), "Удирдлага дундаж", "Нийт оноо", "Зэрэглэл", "Тайлбар",
  ];
  const rows = view.results.map((r) => {
    const g = view.ratings[r.person];
    return [
      r.person, r.taken, r.done,
      r.completion == null ? "" : Math.round(r.completion * 100),
      r.ontime == null ? "" : Math.round(r.ontime * 100),
      r.spi?.toFixed(2) ?? "", r.cpi?.toFixed(2) ?? "",
      r.quality == null ? "" : Math.round(r.quality * 100),
      r.overdue, r.cycle?.toFixed(1) ?? "",
      ...QUAL.map(([k]) => g?.[k] ?? ""),
      r.qualAvg?.toFixed(2) ?? "",
      r.score?.toFixed(1) ?? "",
      r.grade ? `${r.grade.g} ${r.grade.n}` : "",
      g?.note ?? "",
    ];
  });
  const label = view.sprintName ?? `${view.filter.from}_${view.filter.to}`;
  const csv = "\uFEFF" + `${view.sprintName ? `Sprint: ${view.sprintName} · ` : ""}Хугацаа: ${view.filter.from} — ${view.filter.to}\n` + [head, ...rows].map((r) => r.map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `guitsetgeliin-unelgee-${label.replace(/[^\wЀ-ӿ-]+/g, "_")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
