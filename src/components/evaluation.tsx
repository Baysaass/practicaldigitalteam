"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, GradePill, Pill } from "@/components/pill";
import { PersonSheet } from "@/components/person-sheet";
import { saveRating, saveWeights } from "@/app/actions";
import type { View } from "@/lib/data";
import { METRICS, QUAL, type PersonResult, type Weights } from "@/lib/metrics";
import { num, pct, tone } from "@/lib/format";

const field = "h-8 rounded-lg border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

export function Evaluation({ view }: { view: View }) {
  const [open, setOpen] = useState<PersonResult | null>(null);
  const ranked = [...view.results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Онооны карт</CardTitle>
          <CardDescription>Тоон үзүүлэлт Jira-аас автоматаар, чанарын үзүүлэлтийг удирдлага бөглөнө. Өгөгдөлгүй үзүүлэлтийн жин бусдад хуваарилагдана.</CardDescription>
          <CardAction>
            <Button variant="outline" className="print:hidden" onClick={() => exportCsv(view)}>
              <Download />
              Excel
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
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
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {ranked.map((r, i) => (
                <TableRow key={r.person} className="cursor-pointer" onClick={() => setOpen(r)}>
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
                  <TableCell className="text-right">{r.qualAvg == null ? <Pill tone="orange">Бөглөөгүй</Pill> : `${r.qualAvg.toFixed(1)} / 5`}</TableCell>
                  <TableCell className="text-right text-base font-semibold">{r.score == null ? "—" : r.score.toFixed(1)}</TableCell>
                  <TableCell>
                    <GradePill grade={r.grade} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Ratings view={view} />
      <WeightsForm weights={view.weights} />
      <PersonSheet view={view} result={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Ratings({ view }: { view: View }) {
  const [pending, start] = useTransition();
  const save = (person: string, f: string, value: string) =>
    start(async () => {
      try {
        await saveRating(person, view.period, f, value);
        toast.success(`${person}: хадгалагдлаа`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Хадгалж чадсангүй");
      }
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Удирдлагын чанарын үнэлгээ · {view.period}</CardTitle>
        <CardDescription>1 Хангалтгүй · 2 Сайжруулах · 3 Хангалттай · 4 Сайн · 5 Онц. Улирал бүрээр database-д хадгалагдана.</CardDescription>
        {pending && <CardAction className="text-xs text-muted-foreground">Хадгалж байна…</CardAction>}
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Ажилтан</TableHead>
              {QUAL.map(([, n]) => (
                <TableHead key={n}>{n}</TableHead>
              ))}
              <TableHead className="min-w-[260px]">Тайлбар / санал</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.results.map(({ person }) => {
              const q = view.ratings[person];
              return (
                <TableRow key={`${person}-${view.period}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={person} />
                      <span className="font-medium">{person}</span>
                    </div>
                  </TableCell>
                  {QUAL.map(([k]) => (
                    <TableCell key={k}>
                      <select className={`${field} w-20`} defaultValue={q?.[k] ?? ""} onChange={(e) => save(person, k, e.target.value)}>
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </TableCell>
                  ))}
                  <TableCell>
                    <Input
                      defaultValue={q?.note ?? ""}
                      placeholder="Тайлбар…"
                      onBlur={(e) => e.target.value !== (q?.note ?? "") && save(person, "note", e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WeightsForm({ weights }: { weights: Weights }) {
  const [w, setW] = useState(weights);
  const [pending, start] = useTransition();
  const total = METRICS.reduce((a, m) => a + (Number(w[m.k]) || 0), 0);
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Үзүүлэлтийн жин</CardTitle>
        <CardDescription>Байгууллагын дүрэмтэй уялдуулан тохируулна. Нийлбэр 100% байхыг зөвлөнө.</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Pill tone={total === 100 ? "green" : "orange"}>{total}%</Pill>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await saveWeights(w);
                toast.success("Жин хадгалагдлаа");
              })
            }
          >
            Хадгалах
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((m) => (
          <label key={m.k} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{m.n}</span>
            <Input type="number" min={0} max={100} value={w[m.k]} onChange={(e) => setW({ ...w, [m.k]: Number(e.target.value) })} />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function exportCsv(view: View) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Ажилтан", "Авсан", "Хийсэн", "Гүйцэтгэл %", "Хугацаандаа %", "SPI", "CPI", "Чанар %", "Хоцорсон", "Cycle өдөр", ...QUAL.map(([, n]) => n), "Удирдлага дундаж", "Нийт оноо", "Зэрэглэл", "Тайлбар"];
  const rows = view.results.map((r) => {
    const g = view.ratings[r.person];
    return [
      r.person, r.taken, r.done,
      r.completion == null ? "" : Math.round(r.completion * 100), r.ontime == null ? "" : Math.round(r.ontime * 100),
      r.spi?.toFixed(2) ?? "", r.cpi?.toFixed(2) ?? "", r.quality == null ? "" : Math.round(r.quality * 100),
      r.overdue, r.cycle?.toFixed(1) ?? "", ...QUAL.map(([k]) => g?.[k] ?? ""), r.qualAvg?.toFixed(2) ?? "",
      r.score?.toFixed(1) ?? "", r.grade ? `${r.grade.g} ${r.grade.n}` : "", g?.note ?? "",
    ];
  });
  const label = view.sprintName ?? `${view.filter.from}_${view.filter.to}`;
  const csv = "﻿" + `${view.sprintName ? `Sprint: ${view.sprintName} · ` : ""}Хугацаа: ${view.filter.from} — ${view.filter.to}\n` + [head, ...rows].map((r) => r.map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `guitsetgeliin-unelgee-${label.replace(/[^\wЀ-ӿ-]+/g, "_")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
