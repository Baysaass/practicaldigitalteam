"use client";

import { useState } from "react";
import { Award, CheckCircle2, ChevronRight, Clock, Download, FileSpreadsheet, Gauge, Sparkles, TrendingUp, Users } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, GradePill, Pill } from "@/components/pill";
import type { View } from "@/lib/data";
import type { PersonResult } from "@/lib/metrics";
import { num, pct, tone } from "@/lib/format";

export function BenchmarkSection({
  view,
  onSelectPerson,
}: {
  view: View;
  onSelectPerson: (r: PersonResult) => void;
}) {
  const b = view.benchmark;
  const ranked = [...view.results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const [compareA, setCompareA] = useState<string>(ranked[0]?.person || "");
  const [compareB, setCompareB] = useState<string>(ranked[1]?.person || (b ? "team" : ""));

  const personA = ranked.find((r) => r.person === compareA);
  const personB = ranked.find((r) => r.person === compareB);

  return (
    <div className="space-y-6">
      {/* 1. Team Baseline Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <BenchmarkStatCard
          icon={CheckCircle2}
          label="Багийн дундаж гүйцэтгэсэн"
          value={`${b.avgDone.toFixed(1)} task`}
          hint={`Дундаж ${b.avgSp.toFixed(1)} SP`}
        />
        <BenchmarkStatCard
          icon={Clock}
          label="Хугацаандаа дуусгасан"
          value={pct(b.ontime)}
          hint="Хугацааны биелэлт"
          cls={tone(b.ontime, 0.85, 0.7)}
        />
        <BenchmarkStatCard
          icon={Gauge}
          label="Багийн SPI"
          value={num(b.spi)}
          hint="EV ÷ PV бүтээмж"
          cls={tone(b.spi, 0.95, 0.8)}
        />
        <BenchmarkStatCard
          icon={Sparkles}
          label="Чанарын дундаж"
          value={pct(b.quality)}
          hint="Буцаагдаагүй хувь"
          cls={tone(b.quality, 0.9, 0.8)}
        />
        <BenchmarkStatCard
          icon={Clock}
          label="Дундаж Cycle Time"
          value={b.cycle ? `${b.cycle.toFixed(1)} өдөр` : "—"}
          hint="Эхэлснээс дуусах"
        />
        <BenchmarkStatCard
          icon={Award}
          label="Багийн дундаж KPI"
          value={b.avgScore ? b.avgScore.toFixed(1) : "—"}
          hint={b.avgScore ? <GradePill grade={ranked[0]?.grade || null} /> : "Оноогүй"}
        />
      </div>

      {/* 2. Benchmark Table with comparative deltas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            Ажилтнуудын Benchmark ба Улирлын Харьцуулалт
          </CardTitle>
          <CardDescription>
            Багийн дундажтай харьцуулсан зөрүү (Delta) болон тухайн улиралд хаасан ажлуудын үзүүлэлт. Мөрөн дээр дарж дэлгэрэнгүйг харна.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (ranked[0]) {
                  window.location.href = `/api/export-kpi?person=${encodeURIComponent(ranked[0].person)}&quarter=${view.period}`;
                }
              }}
            >
              <FileSpreadsheet className="size-4" />
              Шилдэг ажилтны KPI Excel татах
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="py-2.5 pl-4 pr-2">#</th>
                  <th className="px-3 py-2.5">Ажилтан</th>
                  <th className="px-3 py-2.5 text-right">Хийсэн (SP)</th>
                  <th className="px-3 py-2.5 text-right">Гүйцэтгэл %</th>
                  <th className="px-3 py-2.5 text-right">Хугацаандаа</th>
                  <th className="px-3 py-2.5 text-right">Чанар %</th>
                  <th className="px-3 py-2.5 text-right">Cycle хугацаа</th>
                  <th className="px-3 py-2.5 text-right">Нийт оноо</th>
                  <th className="px-3 py-2.5">Зэрэглэл</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">KPI Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {ranked.map((r, i) => {
                  const doneDiff = r.done - b.avgDone;
                  const ontimeDiff = (r.ontime ?? 0) - (b.ontime ?? 0);
                  const scoreDiff = (r.score ?? 0) - (b.avgScore ?? 0);
                  return (
                    <tr
                      key={r.person}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => onSelectPerson(r)}
                    >
                      <td className="py-3 pl-4 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={r.person} />
                          <div>
                            <div className="font-medium text-foreground">{r.person}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.taken} авснаас {r.done} дууссан
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-semibold">{r.done} task</div>
                        <div className="text-xs text-muted-foreground">
                          {r.sp} SP{" "}
                          <span className={doneDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            ({doneDiff >= 0 ? `+${doneDiff.toFixed(1)}` : doneDiff.toFixed(1)})
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        <span className={tone(r.completion, 0.85, 0.7)}>{pct(r.completion)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className={tone(r.ontime, 0.85, 0.7)}>{pct(r.ontime)}</div>
                        <div className="text-xs text-muted-foreground">
                          {ontimeDiff >= 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{Math.round(ontimeDiff * 100)}%</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">{Math.round(ontimeDiff * 100)}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={tone(r.quality, 0.9, 0.8)}>{pct(r.quality)}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground">
                        {r.cycle ? `${r.cycle.toFixed(1)} өдөр` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-base font-bold">{r.score?.toFixed(1) ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {scoreDiff >= 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{scoreDiff.toFixed(1)}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">{scoreDiff.toFixed(1)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <GradePill grade={r.grade} />
                      </td>
                      <td className="py-3 pl-2 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs font-normal"
                          onClick={() => {
                            window.location.href = `/api/export-kpi?person=${encodeURIComponent(r.person)}&quarter=${view.period}`;
                          }}
                        >
                          <Download className="size-3.5" />
                          Excel
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Interactive Head-to-Head Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Зэрэгцүүлсэн харьцуулалт (Head-to-Head)
          </CardTitle>
          <CardDescription>
            Хоёр ажилтныг сонгож, хугацаа, чанар, бүтээмжээр нь шууд зэрэгцүүлэн харьцуулна.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ажилтан А:</label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
              >
                {ranked.map((r) => (
                  <option key={r.person} value={r.person}>
                    {r.person} ({r.score?.toFixed(1)} оноо · {r.grade?.g})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ажилтан Б:</label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
              >
                {ranked.map((r) => (
                  <option key={r.person} value={r.person}>
                    {r.person} ({r.score?.toFixed(1)} оноо · {r.grade?.g})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {personA && personB && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Profile A */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={personA.person} size="lg" />
                  <div>
                    <div className="font-semibold text-foreground">{personA.person}</div>
                    <div className="text-xs text-muted-foreground">Оноо: {personA.score?.toFixed(1)}</div>
                  </div>
                  <div className="ml-auto">
                    <GradePill grade={personA.grade} />
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm tabular-nums">
                  <ComparisonRow label="Хийсэн task" valA={personA.done} valB={personB.done} />
                  <ComparisonRow label="Story Points" valA={personA.sp} valB={personB.sp} />
                  <ComparisonRow label="Гүйцэтгэл %" valA={Math.round((personA.completion ?? 0) * 100)} valB={Math.round((personB.completion ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="Хугацаандаа %" valA={Math.round((personA.ontime ?? 0) * 100)} valB={Math.round((personB.ontime ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="Чанар %" valA={Math.round((personA.quality ?? 0) * 100)} valB={Math.round((personB.quality ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="SPI" valA={Number(personA.spi?.toFixed(2)) || 0} valB={Number(personB.spi?.toFixed(2)) || 0} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full text-xs"
                  onClick={() => {
                    window.location.href = `/api/export-kpi?person=${encodeURIComponent(personA.person)}&quarter=${view.period}`;
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  {personA.person}-ийн KPI Excel
                </Button>
              </div>

              {/* Metric Breakdown Middle */}
              <div className="flex flex-col justify-center rounded-xl border bg-background p-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Харьцуулалтын ялгаа</div>
                <div className="my-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground">KPI Онооны зөрүү</div>
                    <div className="text-2xl font-bold">
                      {Math.abs((personA.score ?? 0) - (personB.score ?? 0)).toFixed(1)} оноо
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Story Points зөрүү</div>
                    <div className="text-lg font-semibold">
                      {Math.abs(personA.sp - personB.sp)} SP
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Шилдэг гүйцэтгэгч:{" "}
                  <span className="font-semibold text-primary">
                    {(personA.score ?? 0) >= (personB.score ?? 0) ? personA.person : personB.person}
                  </span>
                </div>
              </div>

              {/* Profile B */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={personB.person} size="lg" />
                  <div>
                    <div className="font-semibold text-foreground">{personB.person}</div>
                    <div className="text-xs text-muted-foreground">Оноо: {personB.score?.toFixed(1)}</div>
                  </div>
                  <div className="ml-auto">
                    <GradePill grade={personB.grade} />
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm tabular-nums">
                  <ComparisonRow label="Хийсэн task" valA={personB.done} valB={personA.done} />
                  <ComparisonRow label="Story Points" valA={personB.sp} valB={personA.sp} />
                  <ComparisonRow label="Гүйцэтгэл %" valA={Math.round((personB.completion ?? 0) * 100)} valB={Math.round((personA.completion ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="Хугацаандаа %" valA={Math.round((personB.ontime ?? 0) * 100)} valB={Math.round((personA.ontime ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="Чанар %" valA={Math.round((personB.quality ?? 0) * 100)} valB={Math.round((personA.quality ?? 0) * 100)} unit="%" />
                  <ComparisonRow label="SPI" valA={Number(personB.spi?.toFixed(2)) || 0} valB={Number(personA.spi?.toFixed(2)) || 0} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full text-xs"
                  onClick={() => {
                    window.location.href = `/api/export-kpi?person=${encodeURIComponent(personB.person)}&quarter=${view.period}`;
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  {personB.person}-ийн KPI Excel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BenchmarkStatCard({
  icon: Icon,
  label,
  value,
  hint,
  cls = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  cls?: string;
}) {
  return (
    <Card className="gap-2 py-3">
      <CardContent className="px-3.5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon className="size-4" />
        </div>
        <div className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums ${cls}`}>{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ label, valA, valB, unit = "" }: { label: string; valA: number; valB: number; unit?: string }) {
  const isBetter = valA > valB;
  return (
    <div className="flex items-center justify-between border-b pb-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={isBetter ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-normal text-foreground"}>
        {valA}
        {unit}
      </span>
    </div>
  );
}
