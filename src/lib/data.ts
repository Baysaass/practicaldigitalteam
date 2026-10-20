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
  peopleOf,
  sprintWindow,
} from "./metrics";
import { dayKey, endOfDay, isYmd, quarterOf, startOfDay } from "./time";

export type SearchParams = Record<string, string | string[] | undefined>;

export async function loadWeights(): Promise<Weights> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "weights"));
  return { ...DEFAULT_WEIGHTS, ...((row?.value as Partial<Weights>) ?? {}) };
}

export async function loadRatings(period: string): Promise<Record<string, Rating>> {
  const db = await getDb();
  const rows = await db.select().from(managerRatings).where(eq(managerRatings.period, period));
  return Object.fromEntries(rows.map((r) => [r.person, { collab: r.collab, comm: r.comm, init: r.init, resp: r.resp, note: r.note }]));
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
  }));
  const list: Sprint[] = sp
    .map((s) => ({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate }))
    .sort((a, b) => (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity));
  return { sprints: list, tasks };
}

/** Serializable task for client components. */
export type TaskLite = { key: string; summary: string; status: string; done: boolean; late: boolean; due: string | null; resolved: string | null };

export type Filter = { sprintId: number | null; from: string; to: string; person: string | null };

export async function buildView(sp: SearchParams) {
  const now = new Date();
  const [{ sprints: allSprints, tasks }, weights] = await Promise.all([loadData(), loadWeights()]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const today = dayKey(now);
  const filter: Filter = {
    sprintId: str("sprint") ? Number(str("sprint")) : null,
    from: isYmd(str("from")) ? str("from")! : `${today.slice(0, 8)}01`,
    to: isYmd(str("to")) ? str("to")! : today,
    person: str("person") || null,
  };

  const sprintTasks = (s: Sprint) => tasks.filter((t) => t.sprintIds.includes(s.id));
  const ctxFor = (s: Sprint): Ctx => {
    const ts = sprintTasks(s);
    const w = sprintWindow(s, ts);
    return { sprint: s, tasks: ts, s: w.s, e: w.e, now };
  };
  const sprint = filter.sprintId != null ? allSprints.find((s) => s.id === filter.sprintId) ?? null : null;
  const C: Ctx = sprint ? ctxFor(sprint) : { sprint: null, tasks, s: startOfDay(filter.from), e: endOfDay(filter.to), now };
  if (sprint) {
    filter.from = dayKey(C.s);
    filter.to = dayKey(C.e);
  }

  const period = quarterOf(C.e);
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

  // person detail: recent tasks + score per sprint (last 8)
  const recentSprints = allSprints.filter((s) => s.startDate && s.startDate <= now).slice(-8);
  const sprintCtxs = recentSprints.map(ctxFor);
  const details = Object.fromEntries(
    people.map((p) => {
      const mine = C.tasks
        .filter((t) => t.assignee === p && (C.sprint || (t.takenAt && t.takenAt >= C.s && t.takenAt <= C.e) || (t.resolvedAt && t.resolvedAt >= C.s && t.resolvedAt <= C.e)))
        .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0))
        .slice(0, 12)
        .map<TaskLite>((t) => ({
          key: t.key, summary: t.summary, status: t.status, done: t.done,
          late: !t.done && !!t.dueAt && t.dueAt < now,
          due: t.dueAt ? dayKey(t.dueAt) : null, resolved: t.resolvedAt ? dayKey(t.resolvedAt) : null,
        }));
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
    daily: dailySeries(C, people),
    details,
    ratings,
    weights,
    hasData: tasks.length > 0,
  };
}

export type View = Awaited<ReturnType<typeof buildView>>;
