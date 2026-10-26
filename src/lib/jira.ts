import "server-only";

/* Jira REST client. Cloud: /rest/api/3/search/jql (token paging). Server / Data Center: /rest/api/2/search. */

export type JiraConfig = {
  baseUrl: string;
  deployment: "cloud" | "server";
  auth: string;
  jql: string;
  spField: string;
  sprintField: string;
  initialDays: number;
  doneNames: Set<string>;
};

export function jiraConfig(): JiraConfig {
  const baseUrl = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const token = process.env.JIRA_API_TOKEN ?? "";
  const email = process.env.JIRA_EMAIL ?? "";
  if (!baseUrl || !token) throw new Error("JIRA_BASE_URL болон JIRA_API_TOKEN тохируулагдаагүй байна.");
  const deployment = process.env.JIRA_DEPLOYMENT === "server" ? "server" : "cloud";
  return {
    baseUrl,
    deployment,
    // Cloud: email + API token (Basic). Server/DC: Personal Access Token (Bearer).
    auth: email ? `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}` : `Bearer ${token}`,
    jql: process.env.JIRA_JQL || "project = IT",
    spField: process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016",
    sprintField: process.env.JIRA_SPRINT_FIELD || "customfield_10020",
    initialDays: Number(process.env.JIRA_INITIAL_DAYS || 120),
    doneNames: new Set(
      (process.env.JIRA_DONE_STATUSES || "Done, Closed, Resolved, Дууссан, Хийгдсэн, Хаагдсан")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    ),
  };
}

type JiraUser = { displayName?: string; accountId?: string; name?: string; key?: string };
type JiraHistory = { created: string; items: { field: string; fromString?: string | null; toString?: string | null; to?: string | null }[] };
export type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, unknown> & {
    summary?: string;
    assignee?: JiraUser | null;
    status?: { name?: string; statusCategory?: { key?: string } };
    issuetype?: { name?: string };
    priority?: { name?: string };
    created?: string;
    updated?: string;
    resolutiondate?: string | null;
    duedate?: string | null;
    timeoriginalestimate?: number | null;
    timespent?: number | null;
  };
  changelog?: { histories?: JiraHistory[] };
};

async function get(cfg: JiraConfig, path: string, params: Record<string, string>) {
  const url = `${cfg.baseUrl}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: cfg.auth, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Fetch every issue matching the JQL (with changelog), page by page. */
export async function searchIssues(cfg: JiraConfig, jql: string, limit = 20_000): Promise<JiraIssue[]> {
  const fields = [
    "summary", "assignee", "status", "issuetype", "priority", "created", "updated", "resolutiondate", "duedate",
    "timeoriginalestimate", "timespent", "parent", "description", "comment", cfg.spField, cfg.sprintField,
  ].join(",");
  const out: JiraIssue[] = [];
  if (cfg.deployment === "cloud") {
    let nextPageToken: string | undefined;
    do {
      const p: Record<string, string> = { jql, fields, expand: "changelog", maxResults: "100" };
      if (nextPageToken) p.nextPageToken = nextPageToken;
      const j = await get(cfg, "/rest/api/3/search/jql", p);
      out.push(...(j.issues ?? []));
      nextPageToken = j.nextPageToken;
    } while (nextPageToken && out.length < limit);
  } else {
    let startAt = 0, total = 0;
    do {
      const j = await get(cfg, "/rest/api/2/search", { jql, fields, expand: "changelog", maxResults: "100", startAt: String(startAt) });
      const batch: JiraIssue[] = j.issues ?? [];
      out.push(...batch);
      total = j.total ?? 0;
      startAt += batch.length;
      if (!batch.length) break;
    } while (startAt < total && out.length < limit);
  }
  return out;
}

export type JiraSprint = { id: number; name: string; state: string | null; boardId: number | null; startDate: Date | null; endDate: Date | null; completeDate: Date | null };

const date = (s: unknown) => {
  if (typeof s !== "string" || !s || s === "<null>") return null;
  const d = new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return isNaN(d.getTime()) ? null : d;
};

/** Sprint field: objects on Cloud, "com.atlassian.greenhopper…Sprint@…[id=1,state=CLOSED,name=…]" strings on Server. */
export function parseSprints(raw: unknown): JiraSprint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s): JiraSprint | null => {
      if (s && typeof s === "object") {
        const o = s as Record<string, unknown>;
        return { id: Number(o.id), name: String(o.name ?? ""), state: (o.state as string) ?? null, boardId: o.boardId != null ? Number(o.boardId) : null,
          startDate: date(o.startDate), endDate: date(o.endDate), completeDate: date(o.completeDate) };
      }
      if (typeof s === "string") {
        const f = (k: string) => s.match(new RegExp(`[\\[,]${k}=([^,\\]]*)`))?.[1] ?? null;
        const id = Number(f("id"));
        if (!id) return null;
        return { id, name: f("name") ?? `Sprint ${id}`, state: f("state")?.toLowerCase() ?? null, boardId: Number(f("rapidViewId")) || null,
          startDate: date(f("startDate")), endDate: date(f("endDate")), completeDate: date(f("completeDate")) };
      }
      return null;
    })
    .filter((s): s is JiraSprint => !!s && !!s.id && !!s.name);
}

function extractAdfText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    return node.map(extractAdfText).filter(Boolean).join(" ");
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.type === "text" && typeof o.text === "string") return o.text;
    if (Array.isArray(o.content)) {
      return o.content.map(extractAdfText).filter(Boolean).join(" ");
    }
  }
  return "";
}

function extractComments(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const list = Array.isArray(o.comments) ? o.comments : [];
    return list
      .map((c: any) => {
        const author = c.author?.displayName ? `${c.author.displayName}: ` : "";
        const body = extractAdfText(c.body).trim();
        return body ? `${author}${body}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Map a Jira issue to our row, deriving taken / started / reopens from the changelog. */
export function normalizeIssue(cfg: JiraConfig, issue: JiraIssue) {
  const f = issue.fields;
  const assignee = f.assignee?.displayName ?? null;
  const assigneeId = f.assignee?.accountId ?? f.assignee?.name ?? f.assignee?.key ?? null;
  const histories = [...(issue.changelog?.histories ?? [])].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  const isDone = (n?: string | null) => !!n && cfg.doneNames.has(n.trim().toLowerCase());
  let takenAt = date(f.created), startedAt: Date | null = null, lastDoneAt: Date | null = null, reopens = 0;
  for (const h of histories) {
    const at = date(h.created);
    for (const it of h.items ?? []) {
      if (it.field === "assignee" && assignee && (it.to === assigneeId || it.toString === assignee)) takenAt = at;
      if (it.field === "status") {
        startedAt ??= at;
        if (isDone(it.fromString) && !isDone(it.toString)) reopens++;
        if (isDone(it.toString)) lastDoneAt = at;
      }
    }
  }
  const category = f.status?.statusCategory?.key ?? (isDone(f.status?.name) ? "done" : null);
  const spRaw = f[cfg.spField];
  const sprintList = parseSprints(f[cfg.sprintField]);
  const due = typeof f.duedate === "string" ? f.duedate : null;
  const parentObj = f.parent as { key?: string; fields?: { summary?: string } } | undefined;
  const parentKey = parentObj?.key ?? null;
  const parentSummary = parentObj?.fields?.summary ?? null;
  const description = extractAdfText(f.description).trim() || null;
  const resolutionNotes = extractComments(f.comment).trim() || null;

  return {
    sprints: sprintList,
    row: {
      key: issue.key,
      jiraId: issue.id,
      summary: f.summary ?? "",
      assignee,
      assigneeId,
      status: f.status?.name ?? "",
      statusCategory: category,
      type: f.issuetype?.name ?? null,
      priority: f.priority?.name ?? null,
      createdAt: date(f.created),
      takenAt,
      startedAt,
      resolvedAt: category === "done" ? date(f.resolutiondate) ?? lastDoneAt : null,
      // due dates are calendar days: the end of that day in the team's timezone
      dueAt: due ? dueEnd(due) : null,
      storyPoints: typeof spRaw === "number" ? spRaw : Number(spRaw) || null,
      estimateSec: f.timeoriginalestimate ?? null,
      spentSec: f.timespent ?? null,
      reopens,
      parentKey,
      parentSummary,
      description,
      resolutionNotes,
      lastSprintId: sprintList.length ? sprintList[sprintList.length - 1].id : null,
      jiraUpdatedAt: date(f.updated),
      syncedAt: new Date(),
    },
  };
}

function dueEnd(ymd: string) {
  const off = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 480) * 60_000;
  return new Date(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) - off + 86_400_000 - 1);
}
