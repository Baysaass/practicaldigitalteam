import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy / Middleware:
 * - Public / direct access: No IP restriction, no username/password prompt.
 * - The dashboard and evaluation pages open directly for everyone.
 * - Management features (/zaki) are secured via application-level PIN code.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
