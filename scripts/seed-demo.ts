/**
 * Fill the database with demo sprints and issues (for trying the dashboard without Jira).
 *   npm run db:seed-demo            → local PGlite (.data/pglite)
 *   DATABASE_URL=… npm run db:seed-demo  → that Postgres
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { issueSprints, issues, sprints } from "../src/db/schema";

const DAY = 86_400_000;

async function main() {
  const db = process.env.DATABASE_URL
    ? drizzle({ client: postgres(process.env.DATABASE_URL, { prepare: false }), schema })
    : ((await (await import("../src/db/local")).createLocalDb()) as unknown as ReturnType<typeof drizzle<typeof schema>>);

  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const people = [["Б.Батболд", 1.0, 0.9], ["Д.Сарангэрэл", 1.2, 0.95], ["Г.Тэмүүлэн", 0.8, 0.75], ["Ц.Оюунчимэг", 1.0, 0.85], ["Э.Ганзориг", 0.9, 0.65], ["Н.Мөнхзул", 1.1, 0.9]] as const;
  const types = ["Task", "Bug", "Story", "Sub-task"], pr = ["High", "Medium", "Low"];
  const sums = ["Даатгалын гэрээний модуль засвар", "Нэхэмжлэлийн API холболт", "Тайлангийн SQL оновчлол", "Хэрэглэгчийн эрхийн тохиргоо", "Сервер шинэчлэл", "Полис хэвлэх загвар", "Нөхөн төлбөрийн workflow", "Мобайл апп алдаа", "Backup шалгалт", "Core систем интеграц"];
  const now = Date.now();
  const first = new Date(now - 98 * DAY);
  first.setUTCHours(0, 0, 0, 0);
  while (first.getUTCDay() !== 1) first.setUTCDate(first.getUTCDate() + 1);

  const spRows: (typeof sprints.$inferInsert)[] = [];
  const isRows: (typeof issues.$inferInsert)[] = [];
  const links: (typeof issueSprints.$inferInsert)[] = [];
  let n = 100;
  for (let k = 0; ; k++) {
    const s = first.getTime() + k * 14 * DAY;
    if (s > now) break;
    const e = s + 12 * DAY - 1;
    const id = 1000 + k;
    spRows.push({ id, name: `IT Sprint ${k + 1}`, state: e < now ? "closed" : "active", startDate: new Date(s), endDate: new Date(e) });
    for (let d = 0; d < 12; d++) {
      const day = s + d * DAY;
      const wd = new Date(day).getUTCDay();
      if (wd === 0 || wd === 6 || day > now) continue;
      for (const [who, speed, q] of people) {
        const cnt = Math.floor(rnd() * 3 * speed * (d < 7 ? 1 : 0.5));
        for (let i = 0; i < cnt; i++) {
          const taken = day + (1 + rnd() * 8) * 3600e3;
          const sp = [1, 2, 3, 5, 8][Math.floor(rnd() * 5)];
          const due = Math.min(taken + (1 + Math.floor(rnd() * 6)) * DAY, e);
          const resolved = taken + (0.3 + (rnd() * sp * 0.9) / speed) * DAY;
          const done = resolved < now && resolved < e + 2 * DAY && rnd() < 0.93;
          const est = sp * 3 * 3600, spent = Math.round(est * (0.7 + rnd() * (1.6 - q)));
          const key = `IT-${n++}`;
          isRows.push({
            key, summary: sums[Math.floor(rnd() * sums.length)], assignee: who, assigneeId: who,
            status: done ? "Done" : rnd() < 0.6 ? "In Progress" : "To Do", statusCategory: done ? "done" : "indeterminate",
            type: types[Math.floor(rnd() * 4)], priority: pr[Math.floor(rnd() * 3)],
            createdAt: new Date(taken), takenAt: new Date(taken), startedAt: new Date(taken + 2 * 3600e3),
            resolvedAt: done ? new Date(resolved) : null, dueAt: new Date(due), storyPoints: sp,
            estimateSec: est, spentSec: done ? spent : Math.round(spent * 0.4), reopens: done && rnd() > q ? 1 : 0, lastSprintId: id,
          });
          links.push({ issueKey: key, sprintId: id });
        }
      }
    }
  }
  await db.delete(issueSprints);
  await db.delete(issues);
  await db.delete(sprints);
  await db.insert(sprints).values(spRows);
  for (let i = 0; i < isRows.length; i += 200) await db.insert(issues).values(isRows.slice(i, i + 200));
  for (let i = 0; i < links.length; i += 500) await db.insert(issueSprints).values(links.slice(i, i + 500));
  console.log(`Demo: ${spRows.length} sprint, ${isRows.length} task`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
