import { NextResponse, type NextRequest } from "next/server";

/**
 * Security middleware / proxy for the entire app:
 * 1. IP Whitelist: Restrict access to internal office / VPN static IPs (ALLOWED_IPS).
 * 2. Basic Auth: Employee performance data must remain private (DASHBOARD_USER, DASHBOARD_PASSWORD).
 *
 * Excluded from this middleware by matcher:
 * - /api/cron/* (verified by CRON_SECRET)
 * - /_next/* and static assets
 */
export function proxy(request: NextRequest) {
  // 1. IP Whitelist check
  const allowedIpsEnv = process.env.ALLOWED_IPS?.trim();
  if (allowedIpsEnv) {
    const clientIp = getClientIp(request);
    const isAllowed = isIpAllowed(clientIp, allowedIpsEnv);

    // In local dev, allow localhost even if not explicitly listed in ALLOWED_IPS
    const isLocalhost =
      process.env.NODE_ENV !== "production" &&
      (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "" || clientIp === "localhost");

    if (!isAllowed && !isLocalhost) {
      return forbiddenResponse(clientIp, request);
    }
  }

  // 2. Basic Auth check
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

/**
 * Extracts the real client IP address from Vercel / reverse proxy headers
 */
function getClientIp(request: NextRequest): string {
  // x-forwarded-for: client, proxy1, proxy2...
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const client = xForwardedFor.split(",")[0]?.trim();
    if (client) return client;
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp?.trim()) return xRealIp.trim();

  // Cloudflare Connecting IP if using Cloudflare proxy
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  return "";
}

/**
 * Checks if client IP matches any allowed IP or CIDR range (e.g. 202.131.233.10 or 202.131.233.0/24)
 */
function isIpAllowed(clientIp: string, allowedIpsEnv: string): boolean {
  if (!clientIp) return false;
  const list = allowedIpsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const pattern of list) {
    if (matchesIp(clientIp, pattern)) return true;
  }
  return false;
}

function matchesIp(clientIp: string, pattern: string): boolean {
  // Direct match (IPv4 or IPv6)
  if (clientIp === pattern) return true;

  // CIDR match (e.g. 192.168.1.0/24 or 202.131.233.0/24)
  if (pattern.includes("/")) {
    const [range, bitsStr] = pattern.split("/");
    const bits = parseInt(bitsStr, 10);
    if (!isNaN(bits) && bits >= 0 && bits <= 32) {
      const clientNum = ipToLong(clientIp);
      const rangeNum = ipToLong(range);
      if (clientNum !== null && rangeNum !== null) {
        const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
        return (clientNum & mask) === (rangeNum & mask);
      }
    }
  }

  return false;
}

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) + n;
  }
  return num >>> 0;
}

function forbiddenResponse(clientIp: string, request: NextRequest) {
  const isApi =
    request.nextUrl.pathname.startsWith("/api") ||
    request.headers.get("accept")?.includes("application/json");

  if (isApi) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Энэхүү систем нь зөвхөн байгууллагын дотоод сүлжээ (Оффис / VPN)-ээс хандах эрхтэй.",
        clientIp: clientIp || "Тодорхойгүй",
      },
      { status: 403 }
    );
  }

  const html = `<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>403 Хандалт хязгаарлагдсан · Гүйцэтгэлийн самбар</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #090d16; color: #f8fafc; }
      .card { background: #131b2e !important; border-color: #1e293b !important; }
      .ip-box { background: #0b1120 !important; border-color: #1e293b !important; color: #94a3b8 !important; }
      .desc { color: #94a3b8 !important; }
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 2.25rem;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      text-align: center;
    }
    .icon {
      width: 52px;
      height: 52px;
      margin: 0 auto 1.25rem;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
    .desc { font-size: 0.925rem; color: #475569; line-height: 1.6; margin-bottom: 1.5rem; }
    .ip-box {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      color: #334155;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-bottom: 1.5rem;
      word-break: break-all;
    }
    .hint {
      font-size: 0.825rem;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>
    <h1>Хандалт хязгаарлагдсан (403)</h1>
    <p class="desc">Энэхүү гүйцэтгэлийн систем нь зөвхөн байгууллагын <strong>дотоод сүлжээ (Оффис / VPN)</strong>-ээс хандах зөвшөөрөлтэй.</p>
    <div class="ip-box">
      Таны IP: <strong>${clientIp || "Тодорхойгүй"}</strong>
    </div>
    <p class="hint">Хэрэв та байгууллагын ажилтан бол VPN-ээ асаах эсвэл оффисын сүлжээнд холбогдоно уу. Асуудал гарвал сүлжээний админдаа дээрх IP хаягийг мэдэгдэнэ үү.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
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
