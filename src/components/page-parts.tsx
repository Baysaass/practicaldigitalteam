import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Filters } from "@/components/filters";
import { type SearchParams, type View, buildView } from "@/lib/data";
import { dayKey } from "@/lib/time";

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Үнэлгээ › {title}</div>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** Loads the view for the current URL; renders filters + content, or an empty / error state. */
export async function WithView({
  searchParams,
  title,
  children,
}: {
  searchParams: Promise<SearchParams>;
  title: string;
  children: (view: View) => React.ReactNode;
}) {
  await connection();
  const sp = await searchParams;
  let view: View;
  try {
    view = await buildView(sp);
  } catch (e) {
    return (
      <>
        <PageHead title={title} />
        <Notice title="Database-тэй холбогдож чадсангүй" text={e instanceof Error ? e.message : String(e)} />
      </>
    );
  }
  return (
    <>
      <PageHead title={title}>
        <Filters filter={view.filter} sprints={view.sprints} people={view.allPeople} today={dayKey(new Date())} />
      </PageHead>
      {view.hasData ? (
        children(view)
      ) : (
        <Notice
          title="Өгөгдөл алга байна"
          text="Jira-ийн тохиргоог (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_JQL) хийгээд дээд талын «Jira-аас татах» товчийг дарна уу. Цаашид өдөр бүр автоматаар татагдана."
        />
      )}
    </>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h3 className="font-semibold">{title}</h3>
        <p className="mx-auto mt-1 max-w-lg text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
