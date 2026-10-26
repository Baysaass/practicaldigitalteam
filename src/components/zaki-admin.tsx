"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Lock, LockOpen, RefreshCw, ShieldCheck, Sparkles, Check, AlertCircle, FileSpreadsheet, Edit3, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, GradePill, Pill } from "@/components/pill";
import { clearZakiPin, saveKpiProfile, saveRating, saveWeights, syncNow, verifyZakiPin, updateZakiPin, type KpiProfileInput } from "@/app/actions";
import type { View } from "@/lib/data";
import { METRICS, QUAL, type Weights } from "@/lib/metrics";

const field = "h-8 rounded-lg border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

export function ZakiAdmin({ view, initialAuthorized }: { view: View; initialAuthorized: boolean }) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [pending, start] = useTransition();

  const handleVerifyPin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin) return;
    start(async () => {
      const res = await verifyZakiPin(pin);
      if (res.ok) {
        setAuthorized(true);
        setPinError("");
        toast.success("Удирдлагын эрх амжилттай баталгаажлаа");
      } else {
        setPinError(res.error || "PIN код буруу байна");
        setPin("");
      }
    });
  };

  const handleLock = () => {
    start(async () => {
      await clearZakiPin();
      setAuthorized(false);
      setPin("");
      toast.info("Удирдлагын горим түгжигдлээ");
    });
  };

  if (!authorized) {
    return (
      <div className="mx-auto my-12 max-w-md">
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <CardTitle className="text-xl">Удирдлагын нэвтрэх хэсэг</CardTitle>
            <CardDescription>
              Чанарын үнэлгээ өгөх, жин тохируулах эрх авахын тулд удирдлагын нууц PIN кодыг оруулна уу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="PIN код оруулна уу…"
                  className="h-12 text-center text-2xl tracking-widest"
                  value={pin}
                  maxLength={10}
                  autoFocus
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (pinError) setPinError("");
                  }}
                />
                {pinError && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="size-3.5" />
                    {pinError}
                  </p>
                )}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    variant="outline"
                    className="h-12 text-lg font-medium"
                    onClick={() => {
                      if (pin.length < 10) setPin((p) => p + num);
                      if (pinError) setPinError("");
                    }}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 text-xs text-muted-foreground"
                  onClick={() => setPin("")}
                >
                  Арилгах
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-lg font-medium"
                  onClick={() => {
                    if (pin.length < 10) setPin((p) => p + "0");
                    if (pinError) setPinError("");
                  }}
                >
                  0
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 text-xs text-muted-foreground"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                >
                  ⌫ Буцах
                </Button>
              </div>

              <Button
                type="submit"
                disabled={!pin}
                loading={pending}
                className="h-11 w-full text-base font-medium"
              >
                {pending ? "Шалгаж байна…" : "Нэвтрэх"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Удирдлагын хяналтын самбар</span>
              <Pill tone="green">Идэвхтэй</Pill>
            </div>
            <div className="text-xs text-muted-foreground">
              Тайлант хугацаа: <span className="font-medium text-foreground">{view.period}</span> · Эндээс удирдлагын чанарын үнэлгээ өгч, жин тохируулна.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncButtonAdmin />
          <Button variant="outline" size="sm" onClick={() => setChangePinOpen(true)}>
            <KeyRound className="size-4" />
            PIN код солих
          </Button>
          <Button variant="outline" size="sm" onClick={handleLock}>
            <LockOpen className="size-4" />
            Түгжих
          </Button>
        </div>
      </div>

      <ChangePinDialog open={changePinOpen} onClose={() => setChangePinOpen(false)} />

      {/* 1. Ratings Form Table */}
      <RatingsForm view={view} />

      {/* 2. KPI Report Additional Fields Manager */}
      <KpiProfilesSection view={view} />

      {/* 3. Weights Configuration Form */}
      <WeightsForm weights={view.weights} />

      {/* 4. Fast KPI Excel Export by Employee */}
      <Card>
        <CardHeader>
          <CardTitle>Улирлын KPI Excel экспорт (Загварын дагуу)</CardTitle>
          <CardDescription>
            «Т.Өсөхбаяр Маркетинг (1)» албан ёсны KPI тайлангийн загвараар ажилтан тус бүрийн тайланг татах боломжтой.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {view.results.map((r) => (
              <Button
                key={r.person}
                variant="outline"
                className="justify-between text-left"
                onClick={() => {
                  window.location.href = `/api/export-kpi?person=${encodeURIComponent(r.person)}&quarter=${view.period}`;
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <Avatar name={r.person} size="sm" />
                  <span className="truncate text-xs font-medium">{r.person}</span>
                </div>
                <Download className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RatingsForm({ view }: { view: View }) {
  const [pending, start] = useTransition();

  const save = (person: string, f: string, value: string) =>
    start(async () => {
      try {
        await saveRating(person, view.period, f, value);
        toast.success(`${person}: ${f === "note" ? "тайлбар" : "үнэлгээ"} хадгалагдлаа`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Хадгалж чадсангүй");
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Удирдлагын чанарын үнэлгээ оруулах · {view.period}
        </CardTitle>
        <CardDescription>
          1 Хангалтгүй · 2 Сайжруулах · 3 Хангалттай · 4 Сайн · 5 Онц. Сонгосон даруйд автоматаар хадгалагдана.
        </CardDescription>
        {pending && <CardAction className="text-xs text-muted-foreground">Хадгалж байна…</CardAction>}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-48">Ажилтан</TableHead>
                {QUAL.map(([, n]) => (
                  <TableHead key={n} className="w-24 text-center">
                    {n}
                  </TableHead>
                ))}
                <TableHead className="w-28 text-center">Дундаж</TableHead>
                <TableHead className="min-w-[260px]">Удирдлагын санал / зөвлөмж</TableHead>
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
                    {QUAL.map(([k]) => (
                      <TableCell key={k} className="text-center">
                        <select
                          className={`${field} w-20 text-center font-medium`}
                          defaultValue={q?.[k] ?? ""}
                          onChange={(e) => save(person, k, e.target.value)}
                        >
                          <option value="">—</option>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v}>
                              {v} оноо
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold tabular-nums">
                      {qualAvg == null ? <Pill tone="orange">Бөглөөгүй</Pill> : `${qualAvg.toFixed(1)} / 5`}
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={q?.note ?? ""}
                        placeholder="Ажилтны улирлын дүгнэлт, зөвлөмж бичих…"
                        onBlur={(e) => e.target.value !== (q?.note ?? "") && save(person, "note", e.target.value)}
                      />
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

function WeightsForm({ weights }: { weights: Weights }) {
  const [w, setW] = useState(weights);
  const [pending, start] = useTransition();
  const total = METRICS.reduce((a, m) => a + (Number(w[m.k]) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Үзүүлэлтийн жингийн тохиргоо</CardTitle>
        <CardDescription>
          Байгууллагын дүрэм журамтай уялдуулан тохируулна. Нийт жингийн нийлбэр 100% байх шаардлагатай.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Pill tone={total === 100 ? "green" : "orange"}>{total}%</Pill>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                await saveWeights(w);
                toast.success("Үзүүлэлтийн жин амжилттай хадгалагдлаа");
              })
            }
          >
            {pending ? "Хадгалж байна…" : "Жин хадгалах"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((m) => (
          <label key={m.k} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{m.n} (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={w[m.k]}
              onChange={(e) => setW({ ...w, [m.k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function SyncButtonAdmin() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      icon={<RefreshCw className="size-3.5" />}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {pending ? "Татаж байна…" : "Jira-аас татах"}
    </Button>
  );
}

function KpiProfilesSection({ view }: { view: View }) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const selectedRating = selectedPerson ? view.ratings[selectedPerson] : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            KPI тайлангийн албан талбарууд (Sheet 1) · {view.period}
          </CardTitle>
          <CardDescription>
            Албан тушаал, хэлтэс, хариуцсан үүрэг, сургалт хөгжил, сайн дурын ажил, удирдлагын дүгнэлт болон ирцийн мэдээллийг тохируулах
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-48">Ажилтан</TableHead>
                  <TableHead>Албан тушаал / Үүрэг</TableHead>
                  <TableHead>Нэгж / Хэлтэс</TableHead>
                  <TableHead className="text-center">Ирц (Хоцролт / Таслалт / Амралт)</TableHead>
                  <TableHead className="text-center">Төлөв</TableHead>
                  <TableHead className="w-40 text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.results.map(({ person }) => {
                  const r = view.ratings[person];
                  const hasCustom = !!(r?.jobTitle || r?.department || r?.conclusion || r?.training || r?.voluntary);
                  return (
                    <TableRow key={person}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={person} />
                          <div>
                            <div className="font-medium">{r?.fullName || person}</div>
                            {r?.fullName && <div className="text-[11px] text-muted-foreground">{person}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r?.jobTitle || "Мэдээлэл технологийн мэргэжилтэн"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{r?.role || "Системийн хөгжүүлэлт, API интеграци"}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r?.department || "Мэдээлэл технологийн хэлтэс"}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                        {r?.lateMinutes ?? 0}м / {r?.absentDays ?? 0}ө / {r?.vacationDays ?? 0}ө
                      </TableCell>
                      <TableCell className="text-center">
                        {hasCustom ? (
                          <Pill tone="green">Бөглөгдсөн</Pill>
                        ) : (
                          <Pill tone="gray">Дефолт</Pill>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setSelectedPerson(person)}
                          >
                            <Edit3 className="size-3.5" />
                            Засах
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            title="KPI Excel татах"
                            onClick={() => {
                              window.location.href = `/api/export-kpi?person=${encodeURIComponent(person)}&quarter=${view.period}`;
                            }}
                          >
                            <Download className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <KpiProfileEditSheet
        person={selectedPerson}
        period={view.period}
        initialData={selectedRating}
        onClose={() => setSelectedPerson(null)}
      />
    </>
  );
}

function KpiProfileEditSheet({
  person,
  period,
  initialData,
  onClose,
}: {
  person: string | null;
  period: string;
  initialData?: View["ratings"][string] | null;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<KpiProfileInput>({
    fullName: "",
    jobTitle: "",
    department: "",
    role: "",
    manager: "",
    training: "",
    voluntary: "",
    improvements: "",
    conclusion: "",
    lateMinutes: 0,
    absentDays: 0,
    vacationDays: 0,
  });

  useEffect(() => {
    if (person) {
      setFormData({
        fullName: initialData?.fullName ?? "",
        jobTitle: initialData?.jobTitle ?? "",
        department: initialData?.department ?? "",
        role: initialData?.role ?? "",
        manager: initialData?.manager ?? "",
        training: initialData?.training ?? "",
        voluntary: initialData?.voluntary ?? "",
        improvements: initialData?.improvements ?? "",
        conclusion: initialData?.conclusion ?? "",
        lateMinutes: initialData?.lateMinutes ?? 0,
        absentDays: initialData?.absentDays ?? 0,
        vacationDays: initialData?.vacationDays ?? 0,
      });
    }
  }, [person, initialData]);

  const [pending, start] = useTransition();

  const handleSave = () => {
    if (!person) return;
    start(async () => {
      try {
        await saveKpiProfile(person, period, formData);
        toast.success(`${person}: KPI тайлангийн талбарууд амжилттай хадгалагдлаа`);
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Хадгалж чадсангүй");
      }
    });
  };

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {person && (
          <>
            <SheetHeader className="border-b pb-3">
              <SheetTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="size-5 text-primary" />
                KPI тайлангийн талбар засах · {person}
              </SheetTitle>
              <SheetDescription>
                Улирал: <span className="font-semibold text-foreground">{period}</span>. Энд бөглөсөн мэдээллүүд албан ёсны KPI Excel тайлангийн 1-р хуудас дээр автоматаар тусна.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Ажилтны бүтэн овог, нэр</span>
                  <Input
                    placeholder="Жишээ: Төмөрбаатар Өсөхбаяр"
                    value={formData.fullName ?? ""}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Албан тушаал</span>
                  <Input
                    placeholder="Жишээ: Системийн шинжээч"
                    value={formData.jobTitle ?? ""}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Нэгж / хэлтэс</span>
                  <Input
                    placeholder="Жишээ: Мэдээлэл технологийн хэлтэс"
                    value={formData.department ?? ""}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Шууд удирдлагын нэр</span>
                  <Input
                    placeholder="Жишээ: Ц.Баярмаа"
                    value={formData.manager ?? ""}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Хариуцсан үүрэг</span>
                <Input
                  placeholder="Жишээ: Системийн архитектур, API интеграци, өгөгдлийн сан хариуцсан"
                  value={formData.role ?? ""}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Сургалт, хөгжил, нийгмийн ажилд оролцсон байдал</span>
                <Textarea
                  rows={2}
                  placeholder="Дотоод болон мэргэжлийн сургалт, технологийн семинарт оролцсон байдал…"
                  value={formData.training ?? ""}
                  onChange={(e) => setFormData({ ...formData, training: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Сайн дурын санаачилга</span>
                <Textarea
                  rows={2}
                  placeholder="Системийн автоматжуулалт, багийн ажлын явцыг хурдасгах санал санаачилга…"
                  value={formData.voluntary ?? ""}
                  onChange={(e) => setFormData({ ...formData, voluntary: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Сайжруулах шаардлагатай талууд /удирдлагын санал, зөвлөмж/</span>
                <Textarea
                  rows={2}
                  placeholder="Ажлын хуваарилалт, эрсдэлийн үнэлгээг улам нарийвчлан сайжруулах…"
                  value={formData.improvements ?? ""}
                  onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Дүгнэлт /улирлын ерөнхий үнэлгээ/</span>
                <Textarea
                  rows={3}
                  placeholder="Тайлант улирлын хугацаанд төлөвлөгдсөн ажлуудыг чанартай биелүүлсэн дүгнэлт…"
                  value={formData.conclusion ?? ""}
                  onChange={(e) => setFormData({ ...formData, conclusion: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-3 gap-2.5 rounded-lg border bg-muted/30 p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Хоцролт (минут)</span>
                  <Input
                    type="number"
                    min={0}
                    value={formData.lateMinutes ?? 0}
                    onChange={(e) => setFormData({ ...formData, lateMinutes: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Таслалт (өдөр)</span>
                  <Input
                    type="number"
                    min={0}
                    value={formData.absentDays ?? 0}
                    onChange={(e) => setFormData({ ...formData, absentDays: Number(e.target.value) })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Ээлжийн амралт (өдөр)</span>
                  <Input
                    type="number"
                    min={0}
                    value={formData.vacationDays ?? 0}
                    onChange={(e) => setFormData({ ...formData, vacationDays: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/export-kpi?person=${encodeURIComponent(person)}&quarter=${period}`;
                  }}
                >
                  <Download className="size-4" />
                  Excel тайлан татах
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Цуцлах
                  </Button>
                  <Button loading={pending} onClick={handleSave}>
                    {pending ? "Хадгалж байна…" : "Хадгалах"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChangePinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      setError("PIN код хамгийн багадаа 4 оронтой байх ёстой.");
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setError("Шинэ PIN код болон давтан оруулсан код таарахгүй байна.");
      return;
    }
    startTransition(async () => {
      const res = await updateZakiPin(newPin.trim());
      if (res.ok) {
        toast.success("Удирдлагын PIN код амжилттай шинэчлэгдлээ!");
        setNewPin("");
        setConfirmPin("");
        setError("");
        onClose();
      } else {
        setError(res.error || "PIN код өөрчлөхөд алдаа гарлаа.");
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-sm border-primary/20 shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="size-5" />
            <CardTitle className="text-lg">Удирдлагын PIN код солих</CardTitle>
          </div>
          <CardDescription>
            Цаашид удирдлагын хэсэгт нэвтрэх шинэ нууц кодоо оруулна уу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Шинэ PIN код (4-8 оронтой)</label>
              <Input
                type="password"
                placeholder="Шинэ PIN"
                className="h-10 text-center text-lg tracking-widest font-mono"
                value={newPin}
                maxLength={8}
                autoFocus
                onChange={(e) => {
                  setNewPin(e.target.value);
                  if (error) setError("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Шинэ PIN давтах</label>
              <Input
                type="password"
                placeholder="Шинэ PIN давтах"
                className="h-10 text-center text-lg tracking-widest font-mono"
                value={confirmPin}
                maxLength={8}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  if (error) setError("");
                }}
              />
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
                Цуцлах
              </Button>
              <Button type="submit" size="sm" loading={isPending} disabled={!newPin || !confirmPin}>
                Хадгалах
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

