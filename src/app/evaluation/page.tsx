import { Suspense } from "react";
import { Evaluation } from "@/components/evaluation";
import { PageSkeleton, WithView } from "@/components/page-parts";

export default function EvaluationPage({ searchParams }: PageProps<"/evaluation">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WithView searchParams={searchParams} title="Гүйцэтгэлийн үнэлгээ">
        {(view) => <Evaluation view={view} />}
      </WithView>
    </Suspense>
  );
}
