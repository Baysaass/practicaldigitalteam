import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { issueSprints, issues, managerRatings, settings, sprints, syncRuns } from "@/db/schema";
import {
  type Ctx,
  DEFAULT_WEIGHTS,
  type PersonResult,
  type Rating,
  type Sprint,
  type Task,
  UNASSIGNED,
  type Weights,
  compute,
  dailySeries,
  getEffectiveDue,
  peopleOf,
  sprintWindow,
} from "./metrics";
import { DAY, dayKey, endOfDay, isYmd, quarterOf, startOfDay } from "./time";

export type SearchParams = Record<string, string | string[] | undefined>;

export async function loadWeights(): Promise<Weights> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "weights"));
  return { ...DEFAULT_WEIGHTS, ...((row?.value as Partial<Weights>) ?? {}) };
}

export async function loadRatings(period: string): Promise<Record<string, Rating>> {
  const db = await getDb();
  const rows = await db.select().from(managerRatings).where(eq(managerRatings.period, period));
  return Object.fromEntries(
    rows.map((r) => [
      r.person,
      {
        collab: r.collab,
        comm: r.comm,
        init: r.init,
        resp: r.resp,
        note: r.note,
        fullName: r.fullName,
        jobTitle: r.jobTitle,
        department: r.department,
        role: r.role,
        manager: r.manager,
        training: r.training,
        voluntary: r.voluntary,
        improvements: r.improvements,
        conclusion: r.conclusion,
        lateMinutes: r.lateMinutes,
        absentDays: r.absentDays,
        vacationDays: r.vacationDays,
      },
    ]),
  );
}

export async function lastSync(): Promise<typeof syncRuns.$inferSelect | null> {
  const db = await getDb();
  const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}

async function loadData(): Promise<{ sprints: Sprint[]; tasks: Task[] }> {
  const db = await getDb();
  const [sp, rows, links] = await Promise.all([
    db.select().from(sprints),
    db.select().from(issues),
    db.select().from(issueSprints),
  ]);
  const bySprint = new Map<string, number[]>();
  for (const l of links) (bySprint.get(l.issueKey) ?? bySprint.set(l.issueKey, []).get(l.issueKey)!).push(l.sprintId);
  const tasks: Task[] = rows.map((r) => ({
    key: r.key,
    summary: r.summary,
    assignee: r.assignee || UNASSIGNED,
    status: r.status,
    done: r.statusCategory === "done",
    type: r.type,
    takenAt: r.takenAt ?? r.createdAt,
    startedAt: r.startedAt,
    resolvedAt: r.statusCategory === "done" ? r.resolvedAt : null,
    dueAt: r.dueAt,
    storyPoints: r.storyPoints,
    estimateSec: r.estimateSec,
    spentSec: r.spentSec,
    reopens: r.reopens,
    sprintIds: bySprint.get(r.key) ?? [],
    parentKey: r.parentKey,
    parentSummary: r.parentSummary,
    description: r.description,
    resolutionNotes: r.resolutionNotes,
  }));
  const list: Sprint[] = sp
    .map((s) => ({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate }))
    .sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity));
  return { sprints: list, tasks };
}

export type TaskLite = {
  key: string;
  summary: string;
  status: string;
  done: boolean;
  late: boolean;
  due: string | null;
  resolved: string | null;
  started: string | null;
  storyPoints: number | null;
  type: string | null;
  reopens: number;
  parentKey?: string | null;
  parentSummary?: string | null;
  description?: string | null;
  resolutionNotes?: string | null;
};

export type Filter = { sprintId: number | null; from: string; to: string; person: string | null; quarter: string | null };

export async function buildView(sp: SearchParams) {
  const now = new Date();
  const [{ sprints: allSprints, tasks }, weights] = await Promise.all([loadData(), loadWeights()]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const today = dayKey(now);
  const qParam = str("quarter");
  let from = isYmd(str("from")) ? str("from")! : `${today.slice(0, 8)}01`;
  let to = isYmd(str("to")) ? str("to")! : today;

  if (qParam && /^\d{4}-Q[1-4]$/.test(qParam)) {
    const y = Number(qParam.slice(0, 4));
    const qn = Number(qParam.slice(6, 7));
    const sm = (qn - 1) * 3 + 1;
    const em = qn * 3;
    const lastDay = new Date(y, em, 0).getDate();
    from = `${y}-${String(sm).padStart(2, "0")}-01`;
    to = `${y}-${String(em).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  const filter: Filter = {
    sprintId: str("sprint") ? Number(str("sprint")) : null,
    from,
    to,
    person: str("person") || null,
    quarter: qParam || null,
  };

  const sprintMap = new Map<number, Sprint>(allSprints.map((s) => [s.id, s]));
  const sprintTasks = (s: Sprint) => tasks.filter((t) => t.sprintIds.includes(s.id));
  const ctxFor = (s: Sprint): Ctx => {
    const ts = sprintTasks(s);
    const w = sprintWindow(s, ts);
    return { sprint: s, tasks: ts, s: w.s, e: w.e, now, allSprints, sprintMap };
  };
  const sprint = filter.sprintId != null ? allSprints.find((s) => s.id === filter.sprintId) ?? null : null;
  const C: Ctx = sprint ? ctxFor(sprint) : { sprint: null, tasks, s: startOfDay(filter.from), e: endOfDay(filter.to), now, allSprints, sprintMap };
  if (sprint) {
    filter.from = dayKey(C.s);
    filter.to = dayKey(C.e);
  }

  const period = qParam || quarterOf(C.e);
  const ratings = await loadRatings(period);
  const allPeople = peopleOf(tasks);
  const people = filter.person ? [filter.person] : peopleOf(C.tasks);
  const results: PersonResult[] = people.map((p) => compute(p, C, ratings[p], weights));

  const sum = (k: keyof PersonResult) => results.reduce((a, r) => a + ((r[k] as number) || 0), 0);
  const T = {
    taken: sum("taken"), done: sum("done"), takenDone: sum("takenDone"), dueN: sum("dueN"), onTime: sum("onTime"),
    PV: sum("PV"), EV: sum("EV"), est: sum("est"), spent: sum("spent"), overdue: sum("overdue"), sp: sum("sp"),
  };
  const scored = results.filter((r) => r.score != null);
  const avgScore = scored.length ? scored.reduce((a, r) => a + r.score!, 0) / scored.length : null;

  const validCycles = results.map((r) => r.cycle).filter((c): c is number => c != null && c > 0);
  const avgCycle = validCycles.length ? validCycles.reduce((a, b) => a + b, 0) / validCycles.length : null;
  const benchmark = {
    avgTaken: people.length ? T.taken / people.length : 0,
    avgDone: people.length ? T.done / people.length : 0,
    avgSp: people.length ? T.sp / people.length : 0,
    completion: T.taken ? T.takenDone / T.taken : null,
    ontime: T.dueN ? T.onTime / T.dueN : null,
    spi: T.PV ? T.EV / T.PV : null,
    cpi: T.spent ? T.est / T.spent : null,
    quality: results.length ? results.reduce((a, r) => a + (r.quality ?? 0), 0) / Math.max(1, results.filter((r) => r.quality != null).length) : null,
    cycle: avgCycle,
    avgScore,
  };

  // person detail: all tasks in the range + score per sprint (last 8)
  const recentSprints = allSprints.filter((s) => s.startDate && s.startDate <= now).slice(-8);
  const sprintCtxs = recentSprints.map(ctxFor);
  const details = Object.fromEntries(
    people.map((p) => {
      const mine = C.tasks
        .filter((t) => {
          if (t.assignee !== p) return false;
          if (C.sprint) return true;
          const effDue = getEffectiveDue(t, null, sprintMap);
          return (
            (t.takenAt && t.takenAt >= C.s && t.takenAt <= C.e) ||
            (t.resolvedAt && t.resolvedAt >= C.s && t.resolvedAt <= C.e) ||
            (effDue && effDue >= C.s && effDue <= C.e)
          );
        })
        .sort((a, b) => (b.resolvedAt?.getTime() ?? b.takenAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? a.takenAt?.getTime() ?? 0))
        .map<TaskLite>((t) => {
          const effDue = getEffectiveDue(t, C.sprint, sprintMap);
          const isLate = !t.done && ((effDue && effDue < now) || (!effDue && t.takenAt && now.getTime() - t.takenAt.getTime() > 21 * DAY));
          return {
            key: t.key,
            summary: t.summary,
            status: t.status,
            done: t.done,
            late: !!isLate,
            due: effDue ? dayKey(effDue) : null,
            resolved: t.resolvedAt ? dayKey(t.resolvedAt) : null,
            started: t.startedAt ? dayKey(t.startedAt) : (t.takenAt ? dayKey(t.takenAt) : null),
            storyPoints: t.storyPoints,
            type: t.type,
            reopens: t.reopens,
            parentKey: t.parentKey,
            parentSummary: t.parentSummary,
            description: t.description,
            resolutionNotes: t.resolutionNotes,
          };
        });
      const history = sprintCtxs
        .filter((c) => c.tasks.some((t) => t.assignee === p))
        .map((c) => ({ name: c.sprint!.name, score: compute(p, c, ratings[p], weights).score }));
      return [p, { recent: mine, history }];
    }),
  );

  return {
    filter,
    period,
    sprints: [...allSprints].reverse().map((s) => ({ id: s.id, name: s.name, state: s.state })),
    sprintName: sprint?.name ?? null,
    allPeople,
    results,
    totals: T,
    avgScore,
    benchmark,
    daily: dailySeries(C, people),
    details,
    ratings,
    weights,
    hasData: tasks.length > 0,
  };
}

export type View = Awaited<ReturnType<typeof buildView>>;
