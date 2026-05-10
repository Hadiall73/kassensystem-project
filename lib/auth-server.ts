/**
 * Server-side Auth-Helper für API-Routen (Layer 5).
 *
 * - issueStaffToken(staff)         → signiertes JWT (1h Gueltigkeit)
 * - requireAuth(req)               → returns staff payload | NextResponse(401)
 * - requireRole(staff, ...roles)   → returns null | NextResponse(403)
 *
 * AUTH_SECRET muss in .env.local gesetzt sein (>= 32 Zeichen).
 * In Dev wird ein ephemerer Secret generiert (Tokens ueberleben keinen Restart).
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { NextResponse } from "next/server";

const NODE_ENV = process.env.NODE_ENV || "development";

const FALLBACKS = new Set([
  "secret",
  "changeme",
  "test",
  "auth-secret",
  "your-secret-here",
]);

function isWeakSecret(s: string | undefined): boolean {
  if (!s) return true;
  if (s.length < 32) return true;
  if (FALLBACKS.has(s)) return true;
  if (/^(.)\1+$/.test(s)) return true;
  return false;
}

let _cachedSecret: string | null = null;
function getSecret(): string {
  if (_cachedSecret) return _cachedSecret;
  let s = process.env.AUTH_SECRET;
  if (isWeakSecret(s)) {
    if (NODE_ENV === "production") {
      throw new Error(
        "[AUTH-FIREWALL] AUTH_SECRET fehlt oder zu schwach (>= 32 Zeichen erforderlich). Setze AUTH_SECRET in .env.local."
      );
    }
    s = crypto.randomBytes(48).toString("base64");
    console.warn(
      "[AUTH-FIREWALL] WARNUNG: AUTH_SECRET schwach/fehlt. Verwende ephemeralen Dev-Secret (Tokens werden bei Restart ungueltig)."
    );
  }
  _cachedSecret = s as string;
  return _cachedSecret;
}

const ISSUER = process.env.AUTH_ISSUER || "kassensystem";
const AUDIENCE = process.env.AUTH_AUDIENCE || "kassensystem-clients";

const SIGN_OPTS: jwt.SignOptions = {
  algorithm: "HS256",
  issuer: ISSUER,
  audience: AUDIENCE,
  expiresIn: "1h",
};

const VERIFY_OPTS: jwt.VerifyOptions = {
  algorithms: ["HS256"],
  issuer: ISSUER,
  audience: AUDIENCE,
};

export type StaffPayload = {
  id: string;
  name: string;
  role: "chef" | "kellner" | "kueche";
  type: "access";
  iat?: number;
  exp?: number;
};

export type StaffMin = Pick<StaffPayload, "id" | "name" | "role">;

export function issueStaffToken(staff: StaffMin): string {
  return jwt.sign(
    { id: staff.id, name: staff.name, role: staff.role, type: "access" },
    getSecret(),
    SIGN_OPTS
  );
}

export function verifyStaffToken(token: string): StaffPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), VERIFY_OPTS) as StaffPayload;
    if (decoded.type !== "access") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Liest "Authorization: Bearer <token>" aus dem Request.
 * Gibt entweder das Staff-Payload zurueck, oder eine 401-NextResponse.
 *
 * Verwendung in API-Routen:
 *   const auth = requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const staff = auth;  // typed StaffPayload
 */
export function requireAuth(req: Request): StaffPayload | NextResponse {
  const header = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) {
    return NextResponse.json({ error: "Kein Token" }, { status: 401 });
  }
  const payload = verifyStaffToken(m[1]!);
  if (!payload) {
    return NextResponse.json({ error: "Ungueltiger Token" }, { status: 401 });
  }
  return payload;
}

/**
 * Prueft ob die Staff-Rolle in der erlaubten Liste ist.
 * Gibt null bei Erfolg, sonst 403-Response.
 */
export function checkRole(
  staff: StaffPayload,
  ...roles: Array<StaffPayload["role"]>
): NextResponse | null {
  if (!roles.includes(staff.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung", required: roles },
      { status: 403 }
    );
  }
  return null;
}
