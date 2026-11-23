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
  routineTasks?: string | null;
  manager?: string | null;
  training?: string | null;
  voluntary?: string | null;
  improvements?: string | null;
  conclusion?: string | null;
  lateMinutes?: number | null;
  absentDays?: number | null;
  vacationDays?: number | null;
  status?: "active" | "inactive" | null;
  leaveStart?: string | null;
  leaveEnd?: string | null;
  leaveReason?: string | null;
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

export function isSubtask(t: { parentKey?: string | null; type?: string | null; parentSummary?: string | null }): boolean {
  return !!t.parentKey || t.type?.toLowerCase() === "sub-task" || t.type?.toLowerCase() === "subtask" || !!t.parentSummary;
}

/** 36 hours grace period for sprint wrap-up, weekend shift, and Monday morning standup */
export const GRACE_PERIOD_MS = 36 * 3600 * 1000;

export function parseSprintNameDates(name: string, refYear: number = 2026): { s: Date; e: Date } | null {
  const m = name.match(/(\d+)-р\s*сар\s*week\s*(\d+)/i);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (month < 1 || month > 12 || week < 1 || week > 5) return null;

  // Mongolian IT team standard convention for weekly sprints in 2026:
  // Month 11 (November 2026):
  // Week 1: Nov 1 ~ Nov 8
  // Week 2: Nov 9 ~ Nov 15
  // Week 3: Nov 16 ~ Nov 22
  // Week 4: Nov 23 ~ Nov 29
  // Week 5: Nov 30 ~ Nov 30
  const lastDayOfMonth = new Date(refYear, month, 0).getDate();
  let startDay = 1;
  let endDay = 7;
  if (month === 11) {
    if (week === 1) { startDay = 1; endDay = 8; }
    else if (week === 2) { startDay = 9; endDay = 15; }
    else if (week === 3) { startDay = 16; endDay = 22; }
    else if (week === 4) { startDay = 23; endDay = 29; }
    else if (week === 5) { startDay = 30; endDay = 30; }
  } else {
    startDay = (week - 1) * 7 + 1;
    endDay = Math.min(week * 7, lastDayOfMonth);
  }

  const sStr = `${refYear}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}T00:00:00+08:00`;
  const eStr = `${refYear}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}T23:59:59.999+08:00`;
  return { s: new Date(sStr), e: new Date(eStr) };
}

export function getEffectiveDue(t: Task, sprintContext: Sprint | null, sprintMap?: Map<number, Sprint>): Date | null {
  if (t.dueAt) return t.dueAt;
  if (sprintContext) {
    if (sprintContext.endDate) {
      return new Date(sprintContext.endDate.getTime() + GRACE_PERIOD_MS);
    }
    const parsed = parseSprintNameDates(sprintContext.name);
    if (parsed) {
      return new Date(parsed.e.getTime() + GRACE_PERIOD_MS);
    }
  }
  if (sprintMap && t.sprintIds?.length) {
    let latestEnd: Date | null = null;
    for (const sid of t.sprintIds) {
      const sp = sprintMap.get(sid);
      const parsedEnd = sp?.endDate ?? (sp ? parseSprintNameDates(sp.name)?.e : null);
      if (parsedEnd && (!latestEnd || parsedEnd > latestEnd)) {
        latestEnd = parsedEnd;
      }
    }
    if (latestEnd) {
      return new Date(latestEnd.getTime() + GRACE_PERIOD_MS);
    }
  }
  return null;
}

export function isPersonOnLeave(rating?: Rating | null, atDate: Date = new Date()): boolean {
  if (!rating) return false;
  if (rating.leaveStart) {
    const s = new Date(`${rating.leaveStart.slice(0, 10)}T00:00:00Z`).getTime() - 480 * 60_000;
    const e = rating.leaveEnd
      ? new Date(`${rating.leaveEnd.slice(0, 10)}T23:59:59Z`).getTime() - 480 * 60_000
      : Infinity;
    const t = atDate.getTime();
    if (t >= s && t <= e) return true;
  }
  if (rating.status === "inactive" && !rating.leaveStart && !rating.leaveEnd) {
    return true;
  }
  return false;
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
  mainTaken: number;
  mainDone: number;
  subTaken: number;
  subDone: number;
  done: number;
  dueN: number;
  onTime: number;
  PV: number;
  EV: number;
  est: number;
  spent: number;
  reopened: number;
  overdue: number;
  onHold: number;
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
  let taken = 0, takenDone = 0, done = 0, dueN = 0, onTime = 0, PV = 0, EV = 0, est = 0, spent = 0, reopened = 0, overdue = 0, onHold = 0, sp = 0;
  let mainTaken = 0, mainDone = 0, subTaken = 0, subDone = 0;
  const cyc: number[] = [];
  for (const t of C.tasks) {
    if (t.assignee !== person) continue;
    const isSub = isSubtask(t);
    const effDue = getEffectiveDue(t, C.sprint, sprintMap);
    const doneIn = t.done && (!t.resolvedAt || (effDue ? t.resolvedAt <= effDue : inR(t.resolvedAt) || t.resolvedAt <= C.e));

    const isActiveInProgress = !t.done && (t.status === "In Progress" || t.status === "Doing" || t.status === "In Review");

    if (sm || inR(t.takenAt) || inR(effDue) || isActiveInProgress) {
      taken++;
      if (isSub) {
        subTaken++;
      } else {
        mainTaken++;
      }
      if (t.done) {
        takenDone++;
        if (isSub) {
          subDone++;
        } else {
          mainDone++;
        }
      }
    }
    if (sm ? t.done : (t.done && (inR(t.resolvedAt) || inR(t.takenAt) || inR(effDue)))) {
      done++;
      sp += t.storyPoints ?? 0;
      if (t.estimateSec && t.spentSec) {
        est += t.estimateSec;
        spent += t.spentSec;
      }
      if (t.reopens > 0) reopened++;

      // A task from >= 1 month ago (created or with a deadline >= 25 days before resolution or before period)
      // was already completed back then in reality, and just closed in Jira recently.
      // Therefore it must NOT be marked as missed deadline / "хугацаандаа амжаагүй".
      const isPastMonthTask = Boolean(
        t.resolvedAt && (
          (effDue && t.resolvedAt.getTime() - effDue.getTime() >= 25 * DAY) ||
          (effDue && effDue.getTime() < C.s.getTime()) ||
          (t.takenAt && t.resolvedAt.getTime() - t.takenAt.getTime() >= 30 * DAY)
        )
      );

      if (t.resolvedAt) {
        const isOldClosedToday = Boolean(
          t.done &&
          t.resolvedAt &&
          dayKey(t.resolvedAt) === dayKey(C.now) &&
          t.takenAt &&
          t.resolvedAt.getTime() - t.takenAt.getTime() > 30 * DAY
        );
        const st = isOldClosedToday
          ? new Date(t.resolvedAt.getTime() - 3 * DAY)
          : (t.startedAt && t.startedAt < t.resolvedAt ? t.startedAt : t.takenAt);
        if (st) {
          const durationDays = (t.resolvedAt.getTime() - st.getTime()) / DAY;
          if (durationDays <= 30) {
            cyc.push(durationDays);
          }
        }
      }

      // On-time tracking
      dueN++;
      if (effDue && t.resolvedAt) {
        if (t.resolvedAt.getTime() <= effDue.getTime() || isPastMonthTask) {
          onTime++;
        }
      } else {
        // If completed without a missed deadline, it completed on time!
        onTime++;
      }
    }
    if (sm || inR(effDue) || inR(t.takenAt) || inR(t.resolvedAt) || isActiveInProgress) {
      // Subtasks have default weight 0.5 (or explicit storyPoints); main tasks have default weight 1.0 (or explicit storyPoints)
      const defaultWeight = isSub ? 0.5 : 1.0;
      const w = t.storyPoints && t.storyPoints > 0 ? t.storyPoints : defaultWeight;
      PV += w;
      if (t.done) EV += w;
    }

    // Overdue / On-hold tracking
    if (!t.done) {
      const onLeave = isPersonOnLeave(rating, effDue ?? C.now);
      if (onLeave) {
        onHold++;
      } else if (effDue && effDue.getTime() <= Math.min(C.now.getTime(), C.e.getTime())) {
        if (sm || inR(effDue)) {
          overdue++;
        }
      }
    }
  }
  const completion = PV ? Math.min(1, EV / PV) : (taken ? takenDone / taken : null);
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
  return { person, taken, takenDone, mainTaken, mainDone, subTaken, subDone, done, dueN, onTime, PV, EV, est, spent, reopened, overdue, onHold, sp, completion, ontime, spi, cpi, quality, cycle, qualAvg, sc, score, grade: gradeOf(score) };
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

  // Try parsing from sprint name (e.g. "11-р сар week3")
  const parsed = parseSprintNameDates(sp.name);
  if (parsed) return parsed;

  const now = Date.now();
  // Filter active task activity dates (started, resolved, or recently taken)
  const resolvedOrStarted = tasks
    .flatMap((t) => [t.startedAt, t.resolvedAt])
    .filter((d): d is Date => !!d)
    .map((d) => d.getTime());

  if (resolvedOrStarted.length > 0) {
    const maxT = Math.max(...resolvedOrStarted);
    // Don't stretch sprint start by more than 14 days before max date
    const minT = Math.max(Math.min(...resolvedOrStarted), maxT - 14 * DAY);
    return { s: new Date(minT), e: new Date(maxT) };
  }

  const ds = tasks.flatMap((t) => [t.takenAt, t.startedAt, t.resolvedAt]).filter((d): d is Date => !!d).map((d) => d.getTime());
  return { s: new Date(ds.length ? Math.min(...ds) : now), e: new Date(ds.length ? Math.max(...ds) : now) };
}
