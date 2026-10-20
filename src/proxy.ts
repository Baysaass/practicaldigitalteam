import { NextResponse, type NextRequest } from "next/server";

/**
 * Basic Auth for the whole app (employee performance data must not be public).
 * Set DASHBOARD_USER and DASHBOARD_PASSWORD in Vercel. The cron endpoint is excluded:
 * it checks CRON_SECRET itself.
 */
export function proxy(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("DASHBOARD_USER / DASHBOARD_PASSWORD тохируулагдаагүй байна.", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (safeEqual(u, user) && safeEqual(rest.join(":"), pass)) return NextResponse.next();
  }
  return new NextResponse("Нэвтрэх шаардлагатай", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Guitsetgel", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
