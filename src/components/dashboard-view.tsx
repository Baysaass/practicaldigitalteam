"use client";

import { useState } from "react";
import { AlertTriangle, Award, CheckCircle2, Clock, Gauge, Inbox, Percent, Timer, TrendingUp, LayoutGrid, FileSpreadsheet } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarsChart } from "@/components/bars-chart";
import { PeopleTable } from "@/components/people-table";
import { BenchmarkSection } from "@/components/benchmark";
import { GradePill, Pill } from "@/components/pill";
import { PersonSheet } from "@/components/person-sheet";
import { DownloadKpiDialog } from "@/components/download-kpi-dialog";
import type { View } from "@/lib/data";
import { GRADES, gradeOf, type PersonResult } from "@/lib/metrics";
import { num, pct, tone } from "@/lib/format";

export function DashboardView({ view }: { view: View }) {
  const [tab, setTab] = useState<"overview" | "benchmark">("overview");
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [downloadPerson, setDownloadPerson] = useState<string | null>(null);

  const T = view.totals;
  const sm = !!view.sprintName;
  const comp = T.taken ? T.takenDone / T.taken : null;
  const ont = T.dueN ? T.onTime / T.dueN : null;
  const spi = T.PV ? T.EV / T.PV : null;
  const cpi = T.spent ? T.est / T.spent : null;
  const counts = Object.fromEntries(GRADES.map((g) => [g.g, 0]));
  let noScore = 0;
  view.results.forEach((r) => (r.grade ? counts[r.grade.g]++ : noScore++));
  const gmax = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-5">
      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 p-1">
          <Button
            variant={tab === "overview" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-2 text-xs font-medium"
            onClick={() => setTab("overview")}
          >
            <LayoutGrid className="size-3.5" />
            Ерөнхий самбар
          </Button>
          <Button
            variant={tab === "benchmark" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-2 text-xs font-medium"
            onClick={() => setTab("benchmark")}
          >
            <TrendingUp className="size-3.5" />
            Улирлын Benchmark & Харьцуулалт
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {view.results[0] && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => {
                setDownloadPerson(view.results[0].person);
              }}
            >
              <FileSpreadsheet className="size-3.5 text-primary" />
              KPI Excel татах ({view.period})
            </Button>
          )}
        </div>
      </div>

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Inbox} label={sm ? "Sprint-д авсан" : "Авсан task"} value={T.taken} hint={sm ? view.sprintName! : `${view.results.length} ажилтан`} />
        <Kpi icon={CheckCircle2} label="Хийсэн task" value={T.done} hint={`${Math.round(T.sp)} story point`} />
        <Kpi icon={Percent} label="Гүйцэтгэлийн хувь" value={pct(comp)} hint="Авснаас дууссан" cls={tone(comp, 0.85, 0.7)} />
        <Kpi icon={Clock} label="Хугацаандаа" value={pct(ont)} hint={sm ? "Due эсвэл sprint дуустал" : "Due date-д амжсан"} cls={tone(ont, 0.85, 0.7)} />
        <Kpi icon={Gauge} label="SPI" value={num(spi)} hint={`EV ${Math.round(T.EV)} ÷ PV ${Math.round(T.PV)}`} cls={tone(spi, 0.95, 0.8)} />
        <Kpi icon={Timer} label="CPI" value={num(cpi)} hint="Төлөвлөсөн ÷ бодит цаг" cls={tone(cpi, 0.95, 0.8)} />
        <Kpi
          icon={AlertTriangle}
          label={sm ? "Дуусаагүй / хоцорсон" : "Хоцорсон нээлттэй"}
          value={T.overdue}
          hint={sm ? "Хугацаандаа дуусаагүй" : "Due өнгөрсөн, дуусаагүй"}
          cls={T.overdue ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}
        />
        <Kpi
          icon={Award}
          label="Багийн дундаж оноо"
          value={view.avgScore == null ? "—" : view.avgScore.toFixed(1)}
          hint={view.avgScore == null ? "Оноо тооцох өгөгдөлгүй" : <GradePill grade={gradeOf(view.avgScore)} />}
        />
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader>
                <CardTitle>Өдөр тутмын урсгал</CardTitle>
                <CardDescription>Багийн хэмжээнд өдөр бүр авсан ба хийсэн task</CardDescription>
                <CardAction className="flex gap-3 text-xs text-muted-foreground">
                  <Legend color="var(--series-2)">Авсан</Legend>
                  <Legend color="var(--series-1)">Хийсэн</Legend>
                </CardAction>
              </CardHeader>
              <CardContent>
                <BarsChart labels={view.daily.days} a={view.daily.taken} b={view.daily.done} names={["Авсан", "Хийсэн"]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Зэрэглэлийн тархалт</CardTitle>
                <CardDescription>Нийт онооны A–E ангилал</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {GRADES.map((g) => (
                    <div key={g.g} className="flex items-center gap-3">
                      <Pill tone={g.tone} className="w-32">
                        {g.g} · {g.n}
                      </Pill>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(counts[g.g] / gmax) * 100}%`, background: "var(--series-1)" }} />
                      </div>
                      <span className="w-6 text-right font-medium tabular-nums">{counts[g.g]}</span>
                    </div>
                  ))}
                </div>
                {noScore > 0 && <div className="mt-3 text-xs text-muted-foreground">{noScore} ажилтан оноо тооцох өгөгдөлгүй</div>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ажилтны товч үзүүлэлт</CardTitle>
              <CardDescription>Мөрөн дээр дарж дэлгэрэнгүй даалгаврууд болон Excel KPI тайлан татна</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <PeopleTable view={view} />
            </CardContent>
          </Card>
        </>
      ) : (
        <BenchmarkSection view={view} onSelectPerson={(r) => setSelectedPerson(r)} />
      )}

      <PersonSheet view={view} result={selectedPerson} onClose={() => setSelectedPerson(null)} />

      <DownloadKpiDialog
        open={!!downloadPerson}
        person={downloadPerson}
        period={view.period}
        onClose={() => setDownloadPerson(null)}
      />
    </div>
  );
}

function Kpi({
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
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon className="size-4" />
        </div>
        <div className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${cls}`}>{value}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  );
}
