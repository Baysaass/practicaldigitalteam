import { Suspense } from "react";
import { ZakiAdmin } from "@/components/zaki-admin";
import { PageSkeleton, WithView } from "@/components/page-parts";
import { isZakiAuthorized } from "@/app/actions";

import type { SearchParams } from "@/lib/data";

export default function ZakiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WithView searchParams={searchParams} title="Удирдлагын үнэлгээ (/zaki)">
        {async (view) => {
          const isAuth = await isZakiAuthorized();
          return <ZakiAdmin view={view} initialAuthorized={isAuth} />;
        }}
      </WithView>
    </Suspense>
  );
}
