import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Edge Middleware – Layer 1 + 2 für kassensystem
 *
 * Layer 1: Zusätzliche Security-Headers (next.config.mjs setzt schon viele,
 *          hier Backup + dynamische Werte)
 * Layer 2: Rate-Limiting pro IP
 *          - /api/*  → 60 Requests / Minute
 *          - sonst   → 200 Requests / Minute
 *
 *          Auth/Login-Routes bekommen einen extra-strengen Limit (siehe unten).
 */

export const config = {
  // läuft für ALLE Requests ausser statische Assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map)).*)"],
};

export function middleware(req: NextRequest) {
  const ip = getClientIp(req);
  const path = req.nextUrl.pathname;

  // Brute-Force-Schutz für Auth-Endpoints (wenn vorhanden)
  if (path.startsWith("/api/auth") || path.startsWith("/api/login")) {
    const r = rateLimit({
      key: `auth:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!r.ok) return tooMany(r, "Zu viele Login-Versuche. Bitte 15 Minuten warten.");
  }

  // Standard-Limits
  const isApi = path.startsWith("/api");
  const r = rateLimit({
    key: `${isApi ? "api" : "page"}:${ip}`,
    limit: isApi ? 60 : 200,
    windowMs: 60 * 1000,
  });
  if (!r.ok) return tooMany(r, "Rate-Limit erreicht.");

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(r.limit));
  res.headers.set("X-RateLimit-Remaining", String(r.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.floor(r.resetAt / 1000)));
  return res;
}

function tooMany(r: { resetAt: number; limit: number }, message: string) {
  const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(r.limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
    },
  });
}
