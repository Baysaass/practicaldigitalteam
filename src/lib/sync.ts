import "server-only";
import { desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { issueSprints, issues, sprints, syncRuns } from "@/db/schema";
import { type JiraSprint, jiraConfig, normalizeIssue, searchIssues } from "./jira";

/** `SET col = excluded.col` for every column except the conflict target. */
function excludedSet<T extends PgTable>(table: T, skip: string[]) {
  const out: Record<string, unknown> = {};
  for (const [prop, col] of Object.entries(getTableColumns(table))) {
    if (!skip.includes(prop)) out[prop] = sql.raw(`excluded."${col.name}"`);
  }
  return out;
}

// Jira JQL dates: "yyyy/MM/dd HH:mm" (interpreted in the Jira user's timezone; we overlap by a day)
const jqlDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ").replace(/-/g, "/");

/**
 * Pull issues updated since the last successful sync (first run: JIRA_INITIAL_DAYS) and upsert them.
 * Runs daily from Vercel Cron and on demand from the dashboard.
 */
export async function runSync(trigger: "cron" | "manual") {
  const db = await getDb();
  const cfg = jiraConfig();
  const [run] = await db.insert(syncRuns).values({ trigger, status: "running" }).returning();
  try {
    const [prev] = await db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.status, "ok"))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    const since = prev?.startedAt ? new Date(prev.startedAt.getTime() - 86_400_000) : null;
    const jql = `(${cfg.jql}) AND updated >= ${since ? `"${jqlDate(since)}"` : `-${cfg.initialDays}d`} ORDER BY updated ASC`;

    const raw = await searchIssues(cfg, jql);
    const sprintMap = new Map<number, JiraSprint>();
    const rows = raw.map((i) => {
      const n = normalizeIssue(cfg, i);
      n.sprints.forEach((s) => sprintMap.set(s.id, s));
      return n;
    });

    if (sprintMap.size) {
      await db
        .insert(sprints)
        .values([...sprintMap.values()].map((s) => ({ ...s, updatedAt: new Date() })))
        .onConflictDoUpdate({ target: sprints.id, set: excludedSet(sprints, ["id"]) });
    }
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await db.insert(issues).values(chunk.map((r) => r.row)).onConflictDoUpdate({ target: issues.key, set: excludedSet(issues, ["key"]) });
      const keys = chunk.map((r) => r.row.key);
      await db.delete(issueSprints).where(inArray(issueSprints.issueKey, keys));
      const links = chunk.flatMap((r) => r.sprints.map((s) => ({ issueKey: r.row.key, sprintId: s.id })));
      if (links.length) await db.insert(issueSprints).values(links).onConflictDoNothing();
    }

    await db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: new Date(), issues: rows.length, sprints: sprintMap.size, message: jql })
      .where(eq(syncRuns.id, run.id));
    return { issues: rows.length, sprints: sprintMap.size };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(syncRuns).set({ status: "error", finishedAt: new Date(), message }).where(eq(syncRuns.id, run.id));
    throw e;
  }
}
