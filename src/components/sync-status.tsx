import { connection } from "next/server";
import { lastSync } from "@/lib/data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pill } from "@/components/pill";

/** Last Jira sync, shown in the navbar. */
export async function SyncStatus() {
  await connection();
  let run: Awaited<ReturnType<typeof lastSync>> = null;
  try {
    run = await lastSync();
  } catch {
    return <Pill tone="red">DB холбогдоогүй</Pill>;
  }
  if (!run) return <span className="hidden text-xs text-muted-foreground sm:inline">Jira-аас татаагүй</span>;
  const when = (run.finishedAt ?? run.startedAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar", dateStyle: "short", timeStyle: "short" });
  const tone = run.status === "ok" ? "green" : run.status === "error" ? "red" : "blue";
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="hidden cursor-default sm:inline-flex" />}>
        <Pill tone={tone}>
          {run.status === "running" ? "Татаж байна" : `Jira · ${when}`}
        </Pill>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        {run.status === "ok" ? `${run.issues} task, ${run.sprints} sprint шинэчлэгдсэн` : run.message ?? ""}
      </TooltipContent>
    </Tooltip>
  );
}
