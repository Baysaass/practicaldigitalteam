import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { getDb } from "@/db";
import { issues, managerRatings } from "@/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { dayKey, quarterOf, startOfDay, endOfDay } from "@/lib/time";

export async function GET(req: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(req.url);
    const person = searchParams.get("person");
    const quarterParam = searchParams.get("quarter");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!person) {
      return new NextResponse("Ажилтны нэр сонгогдоогүй байна.", { status: 400 });
    }

    const now = new Date();
    let qLabel = quarterParam || quarterOf(now);
    let startDate: Date;
    let endDate: Date;

    const qMatch = qLabel.match(/^(\d{4})-Q([1-4])$/);
    if (qMatch) {
      const year = Number(qMatch[1]);
      const qNum = Number(qMatch[2]);
      const startMonth = (qNum - 1) * 3 + 1;
      const endMonth = qNum * 3;
      const lastDayOfEndMonth = new Date(year, endMonth, 0).getDate();
      startDate = startOfDay(`${year}-${String(startMonth).padStart(2, "0")}-01`);
      endDate = endOfDay(`${year}-${String(endMonth).padStart(2, "0")}-${String(lastDayOfEndMonth).padStart(2, "0")}`);
    } else if (fromParam && toParam) {
      startDate = startOfDay(fromParam);
      endDate = endOfDay(toParam);
      qLabel = quarterOf(endDate);
    } else {
      const currentQuarter = quarterOf(now);
      const m = currentQuarter.match(/^(\d{4})-Q([1-4])$/)!;
      const year = Number(m[1]);
      const qNum = Number(m[2]);
      const startMonth = (qNum - 1) * 3 + 1;
      const endMonth = qNum * 3;
      const lastDayOfEndMonth = new Date(year, endMonth, 0).getDate();
      startDate = startOfDay(`${year}-${String(startMonth).padStart(2, "0")}-01`);
      endDate = endOfDay(`${year}-${String(endMonth).padStart(2, "0")}-${String(lastDayOfEndMonth).padStart(2, "0")}`);
    }

    const db = await getDb();

    // Fetch tasks for this person
    const allPersonIssues = await db
      .select()
      .from(issues)
      .where(eq(issues.assignee, person));

    // Filter tasks belonging to this quarter window:
    // Either resolved in range, or taken in range, or due in range
    const quarterTasks = allPersonIssues.filter((t) => {
      const resolved = t.resolvedAt ? t.resolvedAt >= startDate && t.resolvedAt <= endDate : false;
      const taken = t.takenAt ? t.takenAt >= startDate && t.takenAt <= endDate : false;
      const due = t.dueAt ? t.dueAt >= startDate && t.dueAt <= endDate : false;
      return resolved || taken || due;
    });

    // Also fetch manager ratings
    const [rating] = await db
      .select()
      .from(managerRatings)
      .where(and(eq(managerRatings.person, person), eq(managerRatings.period, qLabel)));

    // Locate template file
    const templateCandidates = [
      path.join(process.cwd(), "public/templates/kpi-template.xlsx"),
      path.join(process.cwd(), "Т.Өсөхбаяр Маркетинг (1).xlsx"),
    ];
    const templatePath = templateCandidates.find((p) => fs.existsSync(p));
    if (!templatePath) {
      return new NextResponse("KPI Excel template олдсонгүй.", { status: 500 });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);

    const ws1 = wb.getWorksheet("01_Нэгжийн_тайлан");
    const ws2 = wb.getWorksheet("02_Ажлын_жагсаалт");

    if (!ws1 || !ws2) {
      return new NextResponse("Excel template-ийн Sheet олдсонгүй.", { status: 500 });
    }

    // Format quarter display string: e.g. "2026 Q2"
    const displayQuarter = qLabel.replace("-", " ");
    const todayStr = dayKey(now);

    // 1. Populate Sheet 1: 01_Нэгжийн_тайлан
    ws1.getCell("B5").value = rating?.fullName || person;
    ws1.getCell("D5").value = person;
    ws1.getCell("F5").value = rating?.jobTitle || "Мэдээлэл технологийн мэргэжилтэн";
    ws1.getCell("H5").value = rating?.role || "Системийн хөгжүүлэлт, API интеграци хариуцсан";
    ws1.getCell("B6").value = displayQuarter;
    ws1.getCell("D6").value = rating?.department || "Мэдээлэл технологийн хэлтэс";
    ws1.getCell("F6").value = todayStr;
    ws1.getCell("H6").value = rating?.manager || "Удирдлага";

    // Build automated summaries for goals and work done
    const doneTasks = quarterTasks.filter((t) => t.statusCategory === "done");
    const doneCount = doneTasks.length;
    const totalCount = quarterTasks.length;
    const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

    let onTimeCount = 0;
    quarterTasks.forEach((t) => {
      const isDone = t.statusCategory === "done";
      const due = t.dueAt || endDate;
      if (isDone && (!t.resolvedAt || t.resolvedAt <= due)) {
        onTimeCount++;
      }
    });

    const onTimePct = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 100;

    const subtaskDone = doneTasks.filter((t) => !!t.parentKey || t.type?.toLowerCase() === "sub-task" || !!t.parentSummary);
    const fullTaskDone = doneTasks.filter((t) => !(!!t.parentKey || t.type?.toLowerCase() === "sub-task" || !!t.parentSummary));

    const formatTaskForSummary = (t: (typeof quarterTasks)[number]) => {
      const isSub = !!t.parentKey || t.type?.toLowerCase() === "sub-task" || !!t.parentSummary;
      if (isSub) {
        const parent = t.parentSummary || t.parentKey || "Үндсэн төсөл";
        return `• [Дэд ажил - ${parent}] ${t.key}: ${t.summary} (${t.storyPoints ? `${t.storyPoints} SP` : "Хийгдсэн"})`;
      }
      return `• [Бүхлээр гүйцэтгэсэн] ${t.key}: ${t.summary} (${t.storyPoints ? `${t.storyPoints} SP` : "Хийгдсэн"})`;
    };

    const taskHighlights = doneTasks
      .slice(0, 15)
      .map(formatTaskForSummary)
      .join("\n");

    ws1.getCell("B9").value = `${displayQuarter} улиралд мэдээллийн технологийн хөгжүүлэлт, системийн найдвартай ажиллагаа, төлөвлөгөөт болон дэд даалгавруудыг чанартай биелүүлэх зорилт тавин ажиллав.\n\nХэрэгжүүлсэн гол төсөл, ажлууд:\n${taskHighlights || "- Төлөвлөгөөт ажлуудыг хуваарийн дагуу бүрэн гүйцэтгэв."}`;

    ws1.getCell("B19").value = `Тайлант хугацаанд нийт ${totalCount} даалгавраас ${doneCount} ажлыг (${completionPct}% биелэлттэй) амжилттай дуусгасан.\nҮүнд: ${fullTaskDone.length} үндсэн даалгаврыг бүхэлд нь бие даан, ${subtaskDone.length} дэд даалгаврыг тухайн төсөл, багийн ажилд хамрагдан гүйцэтгэсэн.\n\nДэлгэрэнгүй задаргааг '02_Ажлын_жагсаалт' хуудаснаас үзнэ үү.`;

    // Training / Development / Social
    ws1.getCell("B20").value =
      rating?.training ||
      "Дотоод болон мэргэжлийн сургалт, технологийн семинар, багийн мэдлэг хуваалцах үйл ажиллагаанд идэвхтэй оролцсон.";

    // Voluntary initiatives
    ws1.getCell("B21").value =
      rating?.voluntary ||
      "Системийн архитектур, CI/CD автоматжуулалт, ажлын урсгалыг оновчлох чиглэлээр санал санаачилга гарган хэрэгжүүлсэн.";

    // Areas for improvement
    ws1.getCell("B22").value =
      rating?.improvements ||
      "Ажлын даалгаврын хуваарилалт, эрсдэлийн үнэлгээ болон даалгавар хоорондын уялдааг улам нарийвчлан сайжруулах.";

    // Leadership conclusion
    if (rating?.conclusion) {
      ws1.getCell("B23").value = rating.conclusion;
    } else if (rating?.note) {
      ws1.getCell("B23").value = `Удирдлагын үнэлгээ: ${rating.note}\nХамтын ажиллагаа: ${rating.collab || 5}/5, Харилцаа: ${rating.comm || 5}/5, Санаачилга: ${rating.init || 5}/5, Хариуцлага: ${rating.resp || 5}/5.`;
    } else {
      ws1.getCell("B23").value = `Тайлант ${displayQuarter} хугацаанд төлөвлөгдсөн ажлын даалгавруудыг ${onTimePct}% хугацаанд нь, хариуцлагатайгаар чанартай гүйцэтгэсэн байна.`;
    }

    // Attendance & Vacation (Row 26)
    ws1.getCell("B26").value = Number(rating?.lateMinutes ?? 0);
    ws1.getCell("D26").value = Number(rating?.absentDays ?? 0);
    ws1.getCell("F26").value = Number(rating?.vacationDays ?? 0);
    ws1.getCell("H26").value = todayStr;

    // 2. Populate Sheet 2: 02_Ажлын_жагсаалт
    quarterTasks.forEach((t, i) => {
      const r = 6 + i;
      const isDone = t.statusCategory === "done";
      const startStr = t.startedAt ? dayKey(t.startedAt) : t.takenAt ? dayKey(t.takenAt) : "";
      const dueStr = t.dueAt ? dayKey(t.dueAt) : dayKey(endDate);
      const resStr = t.resolvedAt ? dayKey(t.resolvedAt) : isDone ? todayStr : "";
      const qualityScore = t.reopens === 0 ? 10 : t.reopens === 1 ? 8 : 6;

      const isSubtask = !!t.parentKey || t.type?.toLowerCase() === "sub-task" || !!t.parentSummary;
      const parentTitle = t.parentSummary || t.parentKey || "";

      // Column B: Ажил / төслийн нэр (Show parent project name for subtasks)
      let taskName = "";
      if (isSubtask) {
        taskName = `[${parentTitle ? `${parentTitle} · ` : ""}${t.key}] ${t.summary}`;
      } else {
        taskName = `[${t.key}] ${t.summary}`;
      }
      ws2.getCell(`B${r}`).value = taskName;

      // Column C: Зорилттой холбоо / хариуцсан үүрэг (Distinguish subtask vs full task contribution)
      let roleDesc = "";
      if (isSubtask) {
        roleDesc = `Дэд даалгавар (Оролцсон): ${t.summary}`;
        if (t.description) {
          const cleanDesc = t.description.replace(/\s+/g, " ").trim();
          roleDesc += ` — ${cleanDesc.slice(0, 140)}${cleanDesc.length > 140 ? "..." : ""}`;
        }
      } else {
        roleDesc = `Бүхэлд нь хариуцан гүйцэтгэсэн (${t.type || "Үндсэн даалгавар"}): ${t.summary}`;
        if (t.description) {
          const cleanDesc = t.description.replace(/\s+/g, " ").trim();
          roleDesc += ` — ${cleanDesc.slice(0, 140)}${cleanDesc.length > 140 ? "..." : ""}`;
        }
      }
      ws2.getCell(`C${r}`).value = roleDesc;

      ws2.getCell(`D${r}`).value = isDone ? "Дууссан" : "Явагдаж байна";
      ws2.getCell(`E${r}`).value = startStr;
      ws2.getCell(`F${r}`).value = dueStr;
      ws2.getCell(`G${r}`).value = resStr;
      ws2.getCell(`I${r}`).value = isDone ? 1.0 : 0.0;
      ws2.getCell(`J${r}`).value = qualityScore;

      // Column K: Тайлбар / нотолгоо (Jira notes: creation description, progress/resolution comment, story points)
      const notesParts: string[] = [];
      if (t.description) {
        const cleanDesc = t.description.replace(/\s+/g, " ").trim();
        notesParts.push(`Шаардлага: ${cleanDesc.slice(0, 180)}${cleanDesc.length > 180 ? "..." : ""}`);
      }
      if (t.resolutionNotes) {
        const cleanRes = t.resolutionNotes.replace(/\s+/g, " ").trim();
        notesParts.push(`Гүйцэтгэл: ${cleanRes.slice(0, 180)}${cleanRes.length > 180 ? "..." : ""}`);
      }
      if (t.storyPoints) {
        notesParts.push(`Үнэлгээ: ${t.storyPoints} Story Points`);
      } else {
        notesParts.push(`Төлөв: ${t.status || "Дууссан"}`);
      }
      ws2.getCell(`K${r}`).value = notesParts.join(" | ");
    });

    // Clear remaining demo rows up to row 100
    for (let r = 6 + quarterTasks.length; r <= 100; r++) {
      ws2.getCell(`B${r}`).value = null;
      ws2.getCell(`C${r}`).value = null;
      ws2.getCell(`D${r}`).value = null;
      ws2.getCell(`E${r}`).value = null;
      ws2.getCell(`F${r}`).value = null;
      ws2.getCell(`G${r}`).value = null;
      ws2.getCell(`I${r}`).value = null;
      ws2.getCell(`J${r}`).value = null;
      ws2.getCell(`K${r}`).value = null;
    }

    // Precompute summary results in Sheet 1 while retaining formulas
    const lastRow = Math.max(6, 5 + quarterTasks.length);
    ws1.getCell("C12").value = {
      formula: `IFERROR(AVERAGE('02_Ажлын_жагсаалт'!I6:I${lastRow}),0)`,
      result: totalCount > 0 ? doneCount / totalCount : 1,
    };
    ws1.getCell("C13").value = {
      formula: `IFERROR(COUNTIF('02_Ажлын_жагсаалт'!H6:H${lastRow},"Тийм")/COUNTIF('02_Ажлын_жагсаалт'!B6:B${lastRow},"<>"),0)`,
      result: totalCount > 0 ? onTimeCount / totalCount : 1,
    };
    ws1.getCell("C14").value = {
      formula: `IFERROR(AVERAGE('02_Ажлын_жагсаалт'!J6:J${lastRow}),0)`,
      result: 9.8,
    };
    ws1.getCell("C15").value = {
      formula: `COUNTA('02_Ажлын_жагсаалт'!B6:B${lastRow})`,
      result: totalCount,
    };
    ws1.getCell("C16").value = {
      formula: `COUNTIF('02_Ажлын_жагсаалт'!D6:D${lastRow},"Дууссан")`,
      result: doneCount,
    };

    const buffer = await wb.xlsx.writeBuffer();
    const safePerson = person.replace(/[^\wЀ-ӿ-]+/g, "_");
    const filename = `KPI-Report-${safePerson}-${qLabel}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (e) {
    console.error("Export KPI error:", e);
    return new NextResponse(e instanceof Error ? e.message : "KPI татахад алдаа гарлаа", { status: 500 });
  }
}
