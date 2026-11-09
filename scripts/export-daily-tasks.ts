import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables from .env.local or .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const BASE_URL = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
const EMAIL = process.env.JIRA_EMAIL ?? "";
const TOKEN = process.env.JIRA_API_TOKEN ?? "";

if (!BASE_URL || !TOKEN) {
  console.error("Error: JIRA_BASE_URL and JIRA_API_TOKEN must be set in .env.local");
  process.exit(1);
}

const AUTH = "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

// Extract projects from JIRA_JQL or default
let PROJECTS = ["DEV", "ODOO", "SCRUM"];
if (process.env.JIRA_JQL) {
  const match = process.env.JIRA_JQL.match(/project\s+IN\s*\(([^)]+)\)/i);
  if (match) {
    PROJECTS = match[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
  }
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { name: string; key: string } };
    assignee?: { displayName: string; emailAddress?: string };
    reporter?: { displayName: string };
    creator?: { displayName: string };
    project: { key: string; name: string };
    issuetype?: { name: string };
    priority?: { name: string };
    created: string;
    updated: string;
    resolutiondate?: string;
  };
  changelog?: {
    histories?: {
      author?: { displayName?: string };
      created: string;
      items?: { field: string; fromString?: string | null; toString?: string | null }[];
    }[];
  };
}

async function fetchJira(jql: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      jql,
      maxResults: "100",
      fields: "summary,status,assignee,project,issuetype,priority,created,updated,resolutiondate,reporter,creator",
      expand: "changelog",
    });
    if (nextPageToken) {
      params.set("nextPageToken", nextPageToken);
    }

    const url = `${BASE_URL}/rest/api/3/search/jql?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: AUTH,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    issues.push(...(data.issues || []));
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return issues;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function main() {
  console.log("Fetching Jira tasks for DEV, ODOO, SCRUM...");

  // 1. In Progress tasks (all current)
  const inProgressJql = `project in (${PROJECTS.join(",")}) AND statusCategory = "In Progress" ORDER BY assignee ASC, updated DESC`;
  const inProgressIssues = await fetchJira(inProgressJql);
  console.log(`Found ${inProgressIssues.length} In Progress tasks.`);

  // 2. Done recently (from Friday/past 4 days through today)
  const doneJql = `project in (${PROJECTS.join(",")}) AND statusCategory = "Done" AND updated >= -4d ORDER BY assignee ASC, updated DESC`;
  const doneIssues = await fetchJira(doneJql);
  console.log(`Found ${doneIssues.length} Done tasks (recent/today).`);

  // Build Excel Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "Antigravity Assistant";
  wb.created = new Date();

  // Color Palette
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Slate 800
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // --- Sheet 1: Summary by Assignee ---
  const wsSummary = wb.addWorksheet("Хураангуй (Хүн тус бүрээр)");
  wsSummary.columns = [
    { header: "№", key: "no", width: 6 },
    { header: "Ажилтны нэр (Assignee)", key: "assignee", width: 28 },
    { header: "Хийж байгаа (In Progress)", key: "inProgress", width: 24 },
    { header: "Хийж дуусгасан (Done)", key: "done", width: 24 },
    { header: "Нийт ажил", key: "total", width: 16 },
  ];

  // Aggregate by assignee
  const summaryMap = new Map<string, { inProgress: number; done: number }>();

  const getAssignee = (iss: JiraIssue): string => {
    if (iss.fields.assignee?.displayName) {
      return iss.fields.assignee.displayName;
    }
    const histories = iss.changelog?.histories || [];
    let statusActor: string | null = null;
    for (const h of histories) {
      const author = h.author?.displayName;
      for (const it of h.items || []) {
        if (it.field === "status" && author && author !== "Webmaster") {
          statusActor = author;
        }
      }
    }
    if (statusActor) return statusActor;
    if (iss.fields.reporter?.displayName && iss.fields.reporter.displayName !== "Webmaster") {
      return iss.fields.reporter.displayName;
    }
    if (iss.fields.creator?.displayName && iss.fields.creator.displayName !== "Webmaster") {
      return iss.fields.creator.displayName;
    }
    return "Оноогоогүй";
  };

  for (const iss of inProgressIssues) {
    const a = getAssignee(iss);
    const curr = summaryMap.get(a) || { inProgress: 0, done: 0 };
    curr.inProgress++;
    summaryMap.set(a, curr);
  }

  for (const iss of doneIssues) {
    const a = getAssignee(iss);
    const curr = summaryMap.get(a) || { inProgress: 0, done: 0 };
    curr.done++;
    summaryMap.set(a, curr);
  }

  let idx = 1;
  for (const [assignee, counts] of Array.from(summaryMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    wsSummary.addRow({
      no: idx++,
      assignee,
      inProgress: counts.inProgress,
      done: counts.done,
      total: counts.inProgress + counts.done,
    });
  }

  // --- Sheet 2: In Progress Tasks ---
  const wsProgress = wb.addWorksheet("Одоо хийж байгаа (In Progress)");
  wsProgress.columns = [
    { header: "№", key: "no", width: 6 },
    { header: "Ажилтан", key: "assignee", width: 22 },
    { header: "Төсөл (Space)", key: "project", width: 16 },
    { header: "Таск код", key: "key", width: 14 },
    { header: "Төрөл", key: "type", width: 14 },
    { header: "Таск нэр (Summary)", key: "summary", width: 50 },
    { header: "Төлөв", key: "status", width: 16 },
    { header: "Сүүлд шинэчлэгдсэн", key: "updated", width: 22 },
  ];

  idx = 1;
  for (const iss of inProgressIssues) {
    wsProgress.addRow({
      no: idx++,
      assignee: getAssignee(iss),
      project: `${iss.fields.project.key} (${iss.fields.project.name})`,
      key: iss.key,
      type: iss.fields.issuetype?.name || "-",
      summary: iss.fields.summary,
      status: iss.fields.status.name,
      updated: formatDate(iss.fields.updated),
    });
  }

  // --- Sheet 3: Done Tasks ---
  const wsDone = wb.addWorksheet("Хийж дууссан (Done)");
  wsDone.columns = [
    { header: "№", key: "no", width: 6 },
    { header: "Ажилтан", key: "assignee", width: 22 },
    { header: "Төсөл (Space)", key: "project", width: 16 },
    { header: "Таск код", key: "key", width: 14 },
    { header: "Төрөл", key: "type", width: 14 },
    { header: "Таск нэр (Summary)", key: "summary", width: 50 },
    { header: "Төлөв", key: "status", width: 16 },
    { header: "Дууссан / Шинэчлэгдсэн", key: "updated", width: 22 },
  ];

  idx = 1;
  for (const iss of doneIssues) {
    wsDone.addRow({
      no: idx++,
      assignee: getAssignee(iss),
      project: `${iss.fields.project.key} (${iss.fields.project.name})`,
      key: iss.key,
      type: iss.fields.issuetype?.name || "-",
      summary: iss.fields.summary,
      status: iss.fields.status.name,
      updated: formatDate(iss.fields.resolutiondate || iss.fields.updated),
    });
  }

  // Styling all sheets
  for (const ws of [wsSummary, wsProgress, wsDone]) {
    ws.getRow(1).height = 28;
    ws.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 22;
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          cell.font = { name: "Arial", size: 10 };
          if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        });
      }
    });
  }

  // Save to Desktop and current folder
  const desktopPath = path.join(process.env.HOME || "", "Desktop", "Jira_Onoo_Udriin_Ajluud.xlsx");
  const localPath = path.join(process.cwd(), "..", "Jira_Onoo_Udriin_Ajluud.xlsx");

  await wb.xlsx.writeFile(desktopPath);
  await wb.xlsx.writeFile(localPath);

  console.log(`Successfully generated Excel:`);
  console.log(`- Desktop: ${desktopPath}`);
  console.log(`- Project: ${localPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
