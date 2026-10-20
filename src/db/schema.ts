import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Jira sprints (id = Jira sprint id). */
export const sprints = pgTable("sprints", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state"), // active | closed | future
  boardId: integer("board_id"),
  startDate: ts("start_date"),
  endDate: ts("end_date"),
  completeDate: ts("complete_date"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Jira issues, one row per issue key. */
export const issues = pgTable("issues", {
  key: text("key").primaryKey(),
  jiraId: text("jira_id"),
  summary: text("summary").notNull().default(""),
  assignee: text("assignee"), // display name
  assigneeId: text("assignee_id"),
  status: text("status").notNull().default(""),
  statusCategory: text("status_category"), // new | indeterminate | done
  type: text("type"),
  priority: text("priority"),
  createdAt: ts("created_at"),
  takenAt: ts("taken_at"), // assigned to the current assignee
  startedAt: ts("started_at"), // first status transition
  resolvedAt: ts("resolved_at"),
  dueAt: ts("due_at"),
  storyPoints: real("story_points"),
  estimateSec: integer("estimate_sec"),
  spentSec: integer("spent_sec"),
  reopens: smallint("reopens").notNull().default(0),
  lastSprintId: integer("last_sprint_id"),
  jiraUpdatedAt: ts("jira_updated_at"),
  syncedAt: ts("synced_at").notNull().defaultNow(),
});

/** Every sprint an issue has been part of (carried-over issues belong to several). */
export const issueSprints = pgTable(
  "issue_sprints",
  {
    issueKey: text("issue_key")
      .notNull()
      .references(() => issues.key, { onDelete: "cascade" }),
    sprintId: integer("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueKey, t.sprintId] })],
);

/** Manager's qualitative rating, one per person per quarter (e.g. "2026-Q4"). */
export const managerRatings = pgTable(
  "manager_ratings",
  {
    person: text("person").notNull(),
    period: text("period").notNull(),
    collab: smallint("collab"),
    comm: smallint("comm"),
    init: smallint("init"),
    resp: smallint("resp"),
    note: text("note"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.person, t.period] })],
);

/** Key/value settings (e.g. metric weights). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Log of Jira sync runs. */
export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(), // cron | manual
  status: text("status").notNull(), // running | ok | error
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  issues: integer("issues").notNull().default(0),
  sprints: integer("sprints").notNull().default(0),
  message: text("message"),
});
