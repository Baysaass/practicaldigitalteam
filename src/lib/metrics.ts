import { DAY, addDays, dayKey } from "./time";

export type Task = {
  key: string;
  summary: string;
  assignee: string;
  status: string;
  done: boolean;
  type: string | null;
  takenAt: Date | null;
  startedAt: Date | null;
  resolvedAt: Date | null;
  dueAt: Date | null;
  storyPoints: number | null;
  estimateSec: number | null;
  spentSec: number | null;
  reopens: number;
  sprintIds: number[];
  parentKey?: string | null;
  parentSummary?: string | null;
  description?: string | null;
  resolutionNotes?: string | null;
};

export type Sprint = {
  id: number;
  name: string;
  state: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

export type Rating = {
  collab: number | null;
  comm: number | null;
  init: number | null;
  resp: number | null;
  note: string | null;
  fullName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  role?: string | null;
  manager?: string | null;
  training?: string | null;
  voluntary?: string | null;
  improvements?: string | null;
  conclusion?: string | null;
  lateMinutes?: number | null;
  absentDays?: number | null;
  vacationDays?: number | null;
};

export const METRICS = [
  { k: "completion", n: "Гүйцэтгэл", w: 20 },
  { k: "ontime", n: "Хугацаандаа", w: 20 },
  { k: "spi", n: "SPI", w: 15 },
  { k: "cpi", n: "CPI", w: 10 },
  { k: "quality", n: "Чанар", w: 15 },
  { k: "qual", n: "Удирдлага", w: 20 },
] as const;
export type MetricKey = (typeof METRICS)[number]["k"];
export type Weights = Record<MetricKey, number>;
export const DEFAULT_WEIGHTS: Weights = Object.fromEntries(METRICS.map((m) => [m.k, m.w])) as Weights;

export const QUAL = [
  ["collab", "Хамтын ажиллагаа"],
  ["comm", "Харилцаа"],
  ["init", "Санаачилга"],
  ["resp", "Хариуцлага"],
] as const;

export const UNASSIGNED = "Хуваарилаагүй";

export const GRADES = [
  { g: "A", n: "Онц", tone: "green", min: 90 },
  { g: "B", n: "Сайн", tone: "blue", min: 80 },
  { g: "C", n: "Хангалттай", tone: "gray", min: 70 },
  { g: "D", n: "Сайжруулах", tone: "orange", min: 60 },
  { g: "E", n: "Хангалтгүй", tone: "red", min: -1 },
] as const;
export type Grade = (typeof GRADES)[number];
export const gradeOf = (s: number | null): Grade | null => (s == null ? null : GRADES.find((g) => s >= g.min) ?? null);

/** 36 hours grace period for sprint wrap-up, weekend shift, and Monday morning standup */
export const GRACE_PERIOD_MS = 36 * 3600 * 1000;

export function getEffectiveDue(t: Task, sprintContext: Sprint | null, sprintMap?: Map<number, Sprint>): Date | null {
  if (t.dueAt) return t.dueAt;
  if (sprintContext?.endDate) {
    return new Date(sprintContext.endDate.getTime() + GRACE_PERIOD_MS);
  }
  if (sprintMap && t.sprintIds?.length) {
    let latestEnd: Date | null = null;
    for (const sid of t.sprintIds) {
      const sp = sprintMap.get(sid);
      if (sp?.endDate && (!latestEnd || sp.endDate > latestEnd)) {
        latestEnd = sp.endDate;
      }
    }
    if (latestEnd) {
      return new Date(latestEnd.getTime() + GRACE_PERIOD_MS);
    }
  }
  return null;
}

/** Evaluation window: a sprint (its tasks are the commitment) or a date range. */
export type Ctx = {
  sprint: Sprint | null;
  tasks: Task[];
  s: Date;
  e: Date;
  now: Date;
  allSprints?: Sprint[];
  sprintMap?: Map<number, Sprint>;
};

export type PersonResult = {
  person: string;
  taken: number;
  takenDone: number;
  done: number;
  dueN: number;
  onTime: number;
  PV: number;
  EV: number;
  est: number;
  spent: number;
  reopened: number;
  overdue: number;
  sp: number;
  completion: number | null;
  ontime: number | null;
  spi: number | null;
  cpi: number | null;
  quality: number | null;
  cycle: number | null;
  qualAvg: number | null;
  sc: Record<MetricKey, number | null>;
  score: number | null;
  grade: Grade | null;
};

/*
 * Sprint mode: every task in the sprint is the commitment (PV); done = Done and resolved by sprint end (EV).
 * Date mode:   taken / resolved / due dates must fall inside the chosen range.
 */
export function compute(person: string, C: Ctx, rating: Rating | undefined, weights: Weights): PersonResult {
  const sm = !!C.sprint;
  const sprintMap = C.sprintMap ?? (C.allSprints ? new Map(C.allSprints.map((s) => [s.id, s])) : undefined);
  const inR = (d: Date | null) => !!d && d >= C.s && d <= C.e;
  let taken = 0, takenDone = 0, done = 0, dueN = 0, onTime = 0, PV = 0, EV = 0, est = 0, spent = 0, reopened = 0, overdue = 0, sp = 0;
  const cyc: number[] = [];
  for (const t of C.tasks) {
    if (t.assignee !== person) continue;
    const effDue = getEffectiveDue(t, C.sprint, sprintMap);
    const doneIn = t.done && (!t.resolvedAt || (effDue ? t.resolvedAt <= effDue : inR(t.resolvedAt) || t.resolvedAt <= C.e));

    if (sm || inR(t.takenAt) || inR(effDue)) {
      taken++;
      if (t.done) takenDone++;
    }
    if (sm ? t.done : (t.done && (inR(t.resolvedAt) || inR(t.takenAt) || inR(effDue)))) {
      done++;
      sp += t.storyPoints ?? 0;
      if (t.estimateSec && t.spentSec) {
        est += t.estimateSec;
        spent += t.spentSec;
      }
      if (t.reopens > 0) reopened++;
      if (t.resolvedAt) {
        const st = t.startedAt && t.startedAt < t.resolvedAt ? t.startedAt : t.takenAt;
        if (st) cyc.push((t.resolvedAt.getTime() - st.getTime()) / DAY);
      }

      // On-time tracking
      dueN++;
      if (effDue && t.resolvedAt) {
        if (t.resolvedAt.getTime() <= effDue.getTime()) {
          onTime++;
        }
      } else {
        // If completed without a missed deadline, it completed on time!
        onTime++;
      }
    }
    if (sm || inR(effDue) || inR(t.takenAt) || inR(t.resolvedAt)) {
      const w = t.storyPoints || 1;
      PV += w;
      if (t.done) EV += w;
    }

    // Overdue tracking: only open tasks past deadline
    if (!t.done) {
      if (effDue && effDue.getTime() <= Math.min(C.now.getTime(), C.e.getTime())) {
        overdue++;
      } else if (!effDue && t.takenAt && (C.now.getTime() - t.takenAt.getTime() > 21 * DAY)) {
        overdue++;
      }
    }
  }
  const completion = taken ? takenDone / taken : null;
  const ontime = dueN ? onTime / dueN : null;
  const spi = PV ? EV / PV : null;
  const cpi = spent ? est / spent : null;
  const quality = done ? 1 - reopened / done : null;
  const cycle = cyc.length ? cyc.reduce((a, b) => a + b, 0) / cyc.length : null;
  const qv = rating ? QUAL.map(([k]) => rating[k]).filter((v): v is number => !!v && v > 0) : [];
  const qualAvg = qv.length ? qv.reduce((a, b) => a + b, 0) / qv.length : null;
  const sc: Record<MetricKey, number | null> = {
    completion: completion == null ? null : completion * 100,
    ontime: ontime == null ? null : ontime * 100,
    spi: spi == null ? null : Math.min(spi, 1) * 100,
    cpi: cpi == null ? null : Math.min(cpi, 1) * 100,
    quality: quality == null ? null : quality * 100,
    qual: qualAvg == null ? null : (qualAvg / 5) * 100,
  };
  let tw = 0, tsum = 0;
  for (const m of METRICS) {
    const w = weights[m.k] || 0;
    const v = sc[m.k];
    if (v != null && w > 0) {
      tw += w;
      tsum += v * w;
    }
  }
  const score = tw ? tsum / tw : null;
  return { person, taken, takenDone, done, dueN, onTime, PV, EV, est, spent, reopened, overdue, sp, completion, ontime, spi, cpi, quality, cycle, qualAvg, sc, score, grade: gradeOf(score) };
}

export function peopleOf(tasks: Task[]): string[] {
  return [...new Set(tasks.map((t) => t.assignee))]
    .filter((p) => p !== UNASSIGNED)
    .sort((a, b) => a.localeCompare(b));
}

/** Day buckets of tasks taken / done, for the team and per person. */
export function dailySeries(C: Ctx, people: string[]) {
  const days: string[] = [];
  for (let d = dayKey(C.s), last = dayKey(C.e); d <= last && days.length < 370; d = addDays(d, 1)) days.push(d);
  const team = Object.fromEntries(days.map((d) => [d, { t: 0, d: 0 }]));
  const set = new Set(people);
  for (const t of C.tasks) {
    if (!set.has(t.assignee)) continue;
    const taken = t.takenAt && team[dayKey(t.takenAt)];
    if (taken) taken.t++;
    const done = t.done && t.resolvedAt && team[dayKey(t.resolvedAt)];
    if (done) done.d++;
  }
  return { days, taken: days.map((d) => team[d].t), done: days.map((d) => team[d].d) };
}

export function sprintWindow(sp: Sprint, tasks: Task[]): { s: Date; e: Date } {
  if (sp.startDate && sp.endDate) return { s: sp.startDate, e: sp.endDate };
  const ds = tasks.flatMap((t) => [t.takenAt, t.startedAt, t.resolvedAt]).filter((d): d is Date => !!d).map((d) => d.getTime());
  const now = Date.now();
  return { s: new Date(ds.length ? Math.min(...ds) : now), e: new Date(ds.length ? Math.max(...ds) : now) };
}
