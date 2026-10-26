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

export type AiExecutiveSummary = {
  goalsSummary: string; // Sheet 1 B9
  resultsSummary: string; // Sheet 1 B19
};

/**
 * Enhances KPI report rows and executive summary using OpenAI GPT-4o-mini.
 * Generates professional, clear, KPI-grade Mongolian descriptions.
 * Falls back to clean rule-based text if OPENAI_API_KEY is missing or request fails.
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
  }
): Promise<{
  tasksMap: Map<string, AiTaskResult>;
  executiveSummary: AiExecutiveSummary | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const tasksMap = new Map<string, AiTaskResult>();

  if (!apiKey || tasks.length === 0) {
    return { tasksMap, executiveSummary: null };
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

    const prompt = `Та бол Монголын даатгал, санхүүгийн салбарын тэргүүлэгч байгууллагын Мэдээлэл Технологийн хэлтсийн хүний нөөц, гүйцэтгэлийн удирдлагын ахлах шинжээч юм.
Ажилтан: "${person}"
Тайлант хугацаа: "${quarterLabel}"
Нийт даалгавар: ${summaryStats.total}, Үүнээс амжилттай дууссан: ${summaryStats.done} (${summaryStats.completionPct}%), Хугацаандаа: ${summaryStats.onTimePct}%

Дараах Jira даалгавруудыг шинжлээд албан ёсны KPI тайлангийн шаардлага хангасан, энгийн ойлгомжтой боловч удирдлага болон Хүний нөөцийн хороонд үнэлэгдэхүйц мэргэжлийн түвшний найруулга бүхий дараах өгөгдлийг JSON хэлбэрээр гаргана уу:

1. taskResults (Array):
   Даалгавар бүрт:
   - "key": даалгаврын түлхүүр (жишээ: DEV-50)
   - "roleDesc": Зорилттой холбоо / хариуцсан үүрэг (Тухайн ажлын байгууллагын систем, хэрэглэгчдэд авчирсан ач холбогдол, ажилтны биечлэн гүйцэтгэсэн үүргийг тодорхой, эерэг, мэргэжлийн үг хэллэгээр 1-2 өгүүлбэрт багтааж бичнэ)
   - "evidence": Тайлбар / нотолгоо (Ажил хэрхэн хийгдсэн, системийн найдвартай ажиллагаа, чанар, тест шалгалт, хүлээлгэн өгсөн бодит үр дүнг нотолсон тайлбар 1-2 өгүүлбэр)

2. "goalsSummary":
   Тухайн улиралд мэдээллийн технологийн хөгжүүлэлт, системийн найдвартай ажиллагаа, дэд бүтцийн чиглэлээр тавьсан зорилго ба гол төслүүдийн нэгдсэн товч дүгнэлт (2-3 цогц өгүүлбэр, албан ёсны KPI хэллэгээр).

3. "resultsSummary":
   Тайлант хугацаанд гүйцэтгэсэн ажлуудын тоон болон чанарын үр дүнгийн нэгдсэн дүгнэлт (Хийгдсэн ажлын тоо, биелэлтийн хувь, багийн болон байгууллагын үйл ажиллагаанд оруулсан бодит хувь нэмэр).

Даалгавруудын жагсаалт:
${JSON.stringify(taskPayload, null, 2)}

Хариуг зөвхөн JSON хэлбэрээр өгнө үү:
{
  "taskResults": [
    { "key": "DEV-...", "roleDesc": "...", "evidence": "..." }
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
            content: "Та зөвхөн өгөгдсөн бүтцийн дагуу зөв JSON объект буцаадаг AI туслах.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.warn("OpenAI API call failed with status", res.status);
      return { tasksMap, executiveSummary: null };
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

    const executiveSummary: AiExecutiveSummary | null =
      parsed.goalsSummary && parsed.resultsSummary
        ? {
            goalsSummary: parsed.goalsSummary,
            resultsSummary: parsed.resultsSummary,
          }
        : null;

    return { tasksMap, executiveSummary };
  } catch (err) {
    console.error("Error generating AI KPI content:", err);
    return { tasksMap, executiveSummary: null };
  }
}
