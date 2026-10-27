import "server-only";

export type TaskForAi = {
  key: string;
  summary: string;
  type?: string | null;
  status?: string | null;
  isDone: boolean;
  isSub?: boolean;
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
 * Enhances KPI report rows and executive summary using OpenAI o3 (with reasoning effort) or GPT-4o.
 * Generates professional, clear, deep, KPI-grade Mongolian descriptions customized to the person's Role and routine non-Jira duties.
 */
export async function generateKpiAiContent(
  person: string,
  quarterLabel: string,
  tasks: TaskForAi[],
  summaryStats: {
    total: number;
    done: number;
    mainTotal?: number;
    mainDone?: number;
    subTotal?: number;
    subDone?: number;
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
        roleDesc: `${personProfile.role || personProfile.jobTitle || "Хариуцсан чиглэл"}-ийн хүрээнд төлөвлөгөөт хуваарийн дагуу тасралтгүй хэрэгжүүлсэн үндсэн үйл ажиллагаа`,
        evidence: "Өдөр тутмын үйл ажиллагаа болон удирдлагын чиглүүлгийн дагуу тасралтгүй чанартай гүйцэтгэж, тайлан мэдээллийн үнэн зөв байдлыг 100% хангасан",
      }));
  };

  if (!apiKey || (tasks.length === 0 && !personProfile?.routineTasks)) {
    return { tasksMap, routineTasks: getFallbackRoutineTasks(), executiveSummary: null };
  }

  try {
    const taskPayload = tasks.slice(0, 45).map((t) => ({
      key: t.key,
      rank: t.isSub ? "II зэрэглэл (Дэд ажил)" : "I зэрэглэл (Үндсэн бие даасан ажил)",
      title: t.summary,
      type: t.type || "Task",
      status: t.status || (t.isDone ? "Done" : "In Progress"),
      parent: t.parentTitle || null,
      desc: t.description ? t.description.slice(0, 300) : null,
      notes: t.resolutionNotes ? t.resolutionNotes.slice(0, 200) : null,
      sp: t.storyPoints || null,
    }));

    const jobTitle = personProfile?.jobTitle || "Мэдээлэл технологийн мэргэжилтэн";
    const role = personProfile?.role || "Системийн хөгжүүлэлт, төслийн удирдлага";
    const routine = personProfile?.routineTasks || "";

    const prompt = `Та бол Монголын санхүү, даатгал, технологийн салбарын тэргүүлэгч байгууллагын Мэдээлэл Технологийн хэлтсийн хүний нөөц, гүйцэтгэлийн удирдлагын ахлах шинжээч юм.

Таны зорилго:
Ажилтны албан ёсны KPI тайлан (Sheet 1 ба Sheet 2)-д орох тайлбар, нотолгоо, нэгдсэн дүгнэлтийг МАШ АНХААРАЛТАЙ, ОЙЛГОМЖТОЙ, ХАНГАЛТТАЙ ДЭЛГЭРЭНГҮЙ, БАТТАЙ НОТОЛГООТОЙ, мэргэжлийн өндөр түвшинд боловсруулах.
Хэзээ ч "Ажлыг цагт нь хийсэн", "Системийг хэвийн ажиллуулсан" гэх мэт ерөнхий, өнгөц, хоосон үг хэрэглэж болохгүй! Даалгавар бүрийн бодит агуулга, технологийн/процессын шийдэл, үр дүнг нарийвчлан гаргана.

Анхаарах гол зарчим:
- "I зэрэглэл (Үндсэн бие даасан ажил)": Тухайн ажилтан бүтэн хариуцлага үүрч, бие даан архитектур, хөгжүүлэлт, менежмент хийсэн ажлууд.
- "II зэрэглэл (Дэд ажил)": Том төслийн хүрээнд тодорхой дэд функц, API холболт, алдаа засалт хийж хамтран гүйцэтгэсэн ажлууд. Үүрэг, тайлбарыг үүнтэй уялдуулан ялгаатай бичнэ.

---
[АЖИЛТНЫ МЭДЭЭЛЭЛ]
Нэр: "${person}" (${personProfile?.fullName || person})
Албан тушаал: "${jobTitle}"
Хариуцсан үндсэн чиглэл / Role: "${role}"
${routine ? `Jira дээр бүртгэгддэггүй өдөр тутмын тогтмол үүргүүд:\n"${routine}"` : ""}
Тайлант хугацаа: "${quarterLabel}"
Гүйцэтгэлийн статистик: Нийт ${summaryStats.total} даалгавраас ${summaryStats.done} амжилттай дууссан (${summaryStats.completionPct}%), хугацаандаа дууссан ${summaryStats.onTimePct}%.
${summaryStats.mainTotal != null ? `• I Зэрэглэл (Үндсэн даалгавар): Нийт ${summaryStats.mainTotal}-аас ${summaryStats.mainDone} хийгдсэн.` : ""}
${summaryStats.subTotal != null ? `• II Зэрэглэл (Дэд ажил): Нийт ${summaryStats.subTotal}-аас ${summaryStats.subDone} хийгдсэн.` : ""}

---
[ШААРДЛАГУУД]

1. "taskResults" (Array):
   Өгөгдсөн Jira даалгавар бүрт (I зэрэглэл болон II зэрэглэлийн ялгааг харгалзан):
   - "key": даалгаврын түлхүүр (жишээ: DEV-102)
   - "roleDesc" (Зорилттой холбоо / хариуцсан үүрэг):
     Ажилтны албан тушаал (${jobTitle}) болон чиглэл (${role})-тэй уялдуулан:
     (1) Энэхүү даалгавар ямар зорилгоор, ямар техникийн эсвэл бизнесийн асуудлыг шийдэхээр хийгдсэн бэ?
     (2) Ажилтан яг ямар бодит үүрэг гүйцэтгэсэн бэ (I зэрэглэл бол үндсэн бие даасан хариуцлага, архитектур; II зэрэглэл бол төслийн тухайн дэд хэсгийн гүйцэтгэл)?
     (3) Байгууллагын/системийн зорилттой хэрхэн уялдав?
     Үүнийг 2-3 бүтэн, тодорхой өгүүлбэрээр тайлбарлаж бичнэ.
   - "evidence" (Тайлбар / нотолгоо):
     Ажил хэрхэн чанартай, бүрэн хийгдсэнийг батлах бодит нотолгоо:
     (1) Тестчлэгдсэн байдал, код ревью, production-д амжилттай байршсан, алдаагүй хэвийн ажиллаж буй байдал.
     (2) Хэрэглэгч болон багийн бүтээмж, системийн найдвартай ажиллагаанд өгсөн бодит үр ашиг.
     (3) Хэрэв Story Points (SP) үнэлгээтэй бол SP үнэ цэнийг тусгана.
     Үүнийг 2-3 бүтэн, найдвартай өгүүлбэрээр бичнэ.

2. "routineTaskResults" (Array):
   ${
     routine
       ? `Ажилтны бичсэн Jira дээр бүртгэгддэггүй өдөр тутмын тогтмол үүргүүдийг Sheet 2 (Ажлын жагсаалт)-д орох 1-3 бие даасан, дэлгэрэнгүй ажил болгон бүрэн задалж бичнэ:
       - "title": Ажлын албан ёсны тодорхой нэр (Жишээ: "Төслийн явцын долоо хоног тутмын нэгдсэн тайлагналт ба эрсдэлийн шинжилгээ (Weekly Report)", "Өдөр тутмын орлогын дата шинэчлэлт, санхүүгийн мониторинг", "Мэдээлэл технологийн багийн ажил хуваарилалт, гүйцэтгэлийн өдөр тутмын хяналт")
       - "roleDesc": Ажилтны уг чиглэлд хариуцан гүйцэтгэсэн өдөр тутмын үүрэг, процессын нарийвчлалыг 2-3 өгүүлбэрээр
       - "evidence": Өдөр бүр / долоо хоног бүр тасралтгүй чанартай гүйцэтгэсэн, удирдлагыг үнэн зөв мэдээллээр хангасан, санхүү/төслийн зөрчилгүй найдвартай байдлыг нотолсон 2-3 өгүүлбэр`
       : `Хоосон массив [] байна.`
   }

3. "goalsSummary" (Sheet 1 B9 - Зорилтын биелэлт):
   Тухайн улиралд ажилтны Role (${jobTitle}, ${role}) болон дэвшүүлсэн үндсэн зорилтууд, Jira төслүүд болон байнгын тогтмол үүргийн хүрээнд хийгдсэн ажлуудын зорилгын нэгдсэн тайлан. (3-4 цогц, уран найруулгатай, албан ёсны KPI өгүүлбэр).

4. "resultsSummary" (Sheet 1 B19 - Үр дүнгийн дүгнэлт):
   Тайлант хугацаанд хүрсэн тоон (гүйцэтгэл ${summaryStats.completionPct}%, хугацаандаа ${summaryStats.onTimePct}%, I зэрэглэлийн үндсэн ажлын биелэлт болон II зэрэглэлийн дэд ажлууд) болон чанарын үр дүн, системийн найдвартай байдал, төслийн менежмент/хөгжүүлэлтийн явцад оруулсан хувь нэмэр, байгууллагад авчирсан үнэ цэнийг нэгтгэн дүгнэсэн 3-4 цогц өгүүлбэр.

---
Даалгавруудын жагсаалт:
${JSON.stringify(taskPayload, null, 2)}

Хариуг зөвхөн дараах JSON бүтцээр буцаана уу:
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

    const parsed = await fetchAiKpiWithBestModel(apiKey, prompt);

    if (parsed && Array.isArray(parsed.taskResults)) {
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
    if (parsed && Array.isArray(parsed.routineTaskResults)) {
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
      parsed?.goalsSummary && parsed?.resultsSummary
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

/**
 * Invokes OpenAI with the highest reasoning effort model (o3 with reasoning_effort)
 * and falls back seamlessly to GPT-4o if primary model fails.
 */
async function fetchAiKpiWithBestModel(
  apiKey: string,
  prompt: string
): Promise<{
  taskResults?: Array<{ key: string; roleDesc: string; evidence: string }>;
  routineTaskResults?: Array<{ title: string; roleDesc: string; evidence: string }>;
  goalsSummary?: string;
  resultsSummary?: string;
} | null> {
  const primaryModel = process.env.OPENAI_KPI_MODEL || "o3";
  const reasoningEffort = process.env.OPENAI_KPI_REASONING_EFFORT || "medium";

  // 1. Try Primary High-Effort Reasoning Model (e.g. o3)
  try {
    const isReasoning = primaryModel.startsWith("o");
    const payload: Record<string, unknown> = {
      model: primaryModel,
      messages: [
        {
          role: "system",
          content: "Та бол Монголын санхүү, технологийн салбарын KPI, гүйцэтгэлийн удирдлагын мэргэшсэн ахлах шинжээч. Бүх тайлбар, нотолгоог маш тодорхой, ажил хэрэгч, үнэмшилтэй, өндөр чанартай монгол хэлээр JSON форматаар гаргана.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 6000,
    };

    if (isReasoning) {
      payload.reasoning_effort = reasoningEffort;
    } else {
      payload.temperature = 0.3;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        return JSON.parse(rawText);
      }
    } else {
      console.warn(`Primary model ${primaryModel} failed (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.warn(`Primary model ${primaryModel} exception:`, err);
  }

  // 2. Fallback to GPT-4o
  try {
    console.log("Falling back to gpt-4o for KPI generation...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Та бол Монголын санхүү, технологийн салбарын KPI, гүйцэтгэлийн удирдлагын мэргэшсэн ахлах шинжээч. Бүх тайлбар, нотолгоог маш тодорхой, ажил хэрэгч, үнэмшилтэй, өндөр чанартай монгол хэлээр JSON форматаар гаргана.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        return JSON.parse(rawText);
      }
    } else {
      console.error(`Fallback gpt-4o failed (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error("Fallback gpt-4o exception:", err);
  }

  return null;
}
