import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { PageSkeleton, WithView } from "@/components/page-parts";

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WithView searchParams={searchParams} title="Хяналтын самбар">
        {(view) => <DashboardView view={view} />}
      </WithView>
    </Suspense>
  );
}
