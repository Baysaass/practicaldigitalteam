import "server-only";

export type TaskForAi = {
  key: string;
  summary: string;
  type?: string | null;
  status?: string | null;
  isDone: boolean;
  description?: string | null;
  resolutionNotes?: string | null;
  parentTitle?: string | null;
  storyPoints?: number | null;
};

export type AiTaskResult = {
  key: string;
  roleDesc: string; // Column C: Зорилттой холбоо / хариуцсан үүрэг
  evidence: string; // Column K: Тайлбар / нотолгоо
};

export type AiRoutineTaskResult = {
  title: string;
  roleDesc: string;
  evidence: string;
};

export type AiExecutiveSummary = {
  goalsSummary: string; // Sheet 1 B9
  resultsSummary: string; // Sheet 1 B19
};

export type PersonProfileForAi = {
  fullName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  role?: string | null;
  routineTasks?: string | null;
  manager?: string | null;
};

/**
 * Enhances KPI report rows and executive summary using OpenAI GPT-4o-mini.
 * Generates professional, clear, KPI-grade Mongolian descriptions customized to the person's Role and routine non-Jira duties.
 */
export async function generateKpiAiContent(
  person: string,
  quarterLabel: string,
  tasks: TaskForAi[],
  summaryStats: {
    total: number;
    done: number;
    completionPct: number;
    onTimePct: number;
  },
  personProfile?: PersonProfileForAi
): Promise<{
  tasksMap: Map<string, AiTaskResult>;
  routineTasks: AiRoutineTaskResult[];
  executiveSummary: AiExecutiveSummary | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const tasksMap = new Map<string, AiTaskResult>();

  // Helper for rule-based fallback routine tasks
  const getFallbackRoutineTasks = (): AiRoutineTaskResult[] => {
    if (!personProfile?.routineTasks) return [];
    return personProfile.routineTasks
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((duty) => ({
        title: duty,
        roleDesc: `${personProfile.role || personProfile.jobTitle || "Хариуцсан чиглэл"}-ийн хүрээнд тогтмол хэрэгжүүлсэн үйл ажиллагаа`,
        evidence: "Удирдлагын чиглэл болон өдөр тутмын үйл ажиллагааны дагуу тасралтгүй чанартай гүйцэтгэсэн",
      }));
  };

  if (!apiKey || (tasks.length === 0 && !personProfile?.routineTasks)) {
    return { tasksMap, routineTasks: getFallbackRoutineTasks(), executiveSummary: null };
  }

  try {
    const taskPayload = tasks.slice(0, 45).map((t) => ({
      key: t.key,
      title: t.summary,
      type: t.type || "Task",
      status: t.status || (t.isDone ? "Done" : "In Progress"),
      parent: t.parentTitle || null,
      desc: t.description ? t.description.slice(0, 200) : null,
      notes: t.resolutionNotes ? t.resolutionNotes.slice(0, 150) : null,
      sp: t.storyPoints || null,
    }));

    const jobTitle = personProfile?.jobTitle || "Мэдээлэл технологийн мэргэжилтэн";
    const role = personProfile?.role || "Системийн хөгжүүлэлт, API интеграци";
    const routine = personProfile?.routineTasks || "";

    const prompt = `Та бол Монголын даатгал, санхүүгийн салбарын тэргүүлэгч байгууллагын Мэдээлэл Технологийн хэлтсийн хүний нөөц, гүйцэтгэлийн удирдлагын ахлах шинжээч юм.

Ажилтан: "${person}" (${personProfile?.fullName || person})
Албан тушаал: "${jobTitle}"
Үндсэн чиглэл / Role: "${role}"
${routine ? `Jira дээр бүртгэгддэггүй өдөр тутмын тогтмол үүргүүд: "${routine}"` : ""}
Тайлант хугацаа: "${quarterLabel}"
Нийт Jira даалгавар: ${summaryStats.total}, Үүнээс амжилттай дууссан: ${summaryStats.done} (${summaryStats.completionPct}%), Хугацаандаа: ${summaryStats.onTimePct}%

Энэхүү ажилтны албан тушаал, хариуцсан Role болон өдөр тутмын тогтмол үүрэгт нь ТУСГАЙЛАН ТОХИРУУЛЖ албан ёсны KPI тайлангийн дараах өгөгдлийг JSON хэлбэрээр гаргана уу:

1. taskResults (Array):
   Jira даалгавар бүрт:
   - "key": даалгаврын түлхүүр
   - "roleDesc": Зорилттой холбоо / хариуцсан үүрэг (Ажилтны Role (${jobTitle}, ${role})-ийн үүднээс энэхүү ажлыг хэрхэн удирдаж, зохион байгуулж, гүйцэтгэснийг мэргэжлийн түвшинд 1-2 өгүүлбэрт багтааж бичнэ)
   - "evidence": Тайлбар / нотолгоо (Ажил хэрхэн чанартай хийгдсэн, системийн найдвартай ажиллагаа, багт үзүүлсэн үр дүнг нотолсон тайлбар 1-2 өгүүлбэр)

2. routineTaskResults (Array):
   ${
     routine
       ? `Дээр дурдсан Jira-д бүртгэгддэггүй өдөр тутмын тогтмол ажлуудаар Sheet 2 (Ажлын жагсаалт)-д шууд оруулах 1-3 бие даасан ажил үүсгэнэ:
       - "title": Ажлын албан нэр (Жишээ: "Төслийн явцын долоо хоног тутмын нэгдсэн тайлан (Weekly Report) бэлтгэж удирдлагад танилцуулах")
       - "roleDesc": Зорилттой холбоо / хариуцсан үүрэг (Жишээ: "Төслийн менежерийн хувиар төслүүдийн явцыг нэгтгэн, эрсдэл болон гүйцэтгэлийг шуурхай тайлагнах")
       - "evidence": Тайлбар / нотолгоо (Жишээ: "Долоо хоног бүр төслийн явцын тайланг тасралтгүй бэлтгэж, удирдлага болон багийг үнэн зөв мэдээллээр тогтмол хангасан")`
       : `Хоосон массив [] байна.`
   }

3. "goalsSummary" (Sheet 1 B9):
   Тухайн улиралд ажилтны Role (${jobTitle}, ${role}) болон тогтмол ажлууд (${routine || "хөгжүүлэлтийн чиглэл"}), мөн Jira төслүүдийн хүрээнд дэвшүүлсэн зорилго, байгууллагад авчирсан үнэ цэнийн нэгдсэн дүгнэлт (2-3 цогц өгүүлбэр, албан ёсны KPI найруулгаар).

4. "resultsSummary" (Sheet 1 B19):
   Тайлант хугацаанд гүйцэтгэсэн ажлуудын тоон болон чанарын үр дүнгийн нэгдсэн дүгнэлт (Долоо хоногийн тайлагналт, санхүү/орлого, төслийн удирдлага, багийн гүйцэтгэлд оруулсан бодит хувь нэмрийг тусгасан 2-3 цогц өгүүлбэр).

Даалгавруудын жагсаалт:
${JSON.stringify(taskPayload, null, 2)}

Хариуг зөвхөн JSON хэлбэрээр өгнө үү:
{
  "taskResults": [
    { "key": "DEV-...", "roleDesc": "...", "evidence": "..." }
  ],
  "routineTaskResults": [
    { "title": "...", "roleDesc": "...", "evidence": "..." }
  ],
  "goalsSummary": "...",
  "resultsSummary": "..."
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Та зөвхөн өгөгдсөн бүтцийн дагуу зөв JSON объект буцаадаг мэргэжлийн HR/KPI туслах.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.warn("OpenAI API call failed with status", res.status);
      return { tasksMap, routineTasks: getFallbackRoutineTasks(), executiveSummary: null };
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

    if (Array.isArray(parsed.taskResults)) {
      for (const item of parsed.taskResults) {
        if (item.key && item.roleDesc && item.evidence) {
          tasksMap.set(item.key, {
            key: item.key,
            roleDesc: item.roleDesc,
            evidence: item.evidence,
          });
        }
      }
    }

    const routineTasksList: AiRoutineTaskResult[] = [];
    if (Array.isArray(parsed.routineTaskResults)) {
      for (const item of parsed.routineTaskResults) {
        if (item.title && item.roleDesc && item.evidence) {
          routineTasksList.push({
            title: item.title,
            roleDesc: item.roleDesc,
            evidence: item.evidence,
          });
        }
      }
    }

    const finalRoutine = routineTasksList.length > 0 ? routineTasksList : getFallbackRoutineTasks();

    const executiveSummary: AiExecutiveSummary | null =
      parsed.goalsSummary && parsed.resultsSummary
        ? {
            goalsSummary: parsed.goalsSummary,
            resultsSummary: parsed.resultsSummary,
          }
        : null;

    return { tasksMap, routineTasks: finalRoutine, executiveSummary };
  } catch (err) {
    console.error("Error generating AI KPI content:", err);
    return { tasksMap, routineTasks: getFallbackRoutineTasks(), executiveSummary: null };
  }
}
