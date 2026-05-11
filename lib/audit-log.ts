/**
 * Audit-Logger fuer kassensystem (Layer 6).
 *
 * Schreibt in Supabase-Tabelle `pos_audit_log` (siehe sql/audit-log.sql).
 * Failed-Closed: Logging-Fehler werfen nie weiter — Anfrage darf nicht brechen.
 *
 * Verwendung:
 *   await auditAction(req, 'ORDER_CANCEL', `Order#${id}`, { staff: auth.id });
 *   await auditSecurity(req, 'LOGIN_FAILED', null, { reason: 'wrong_pin' });
 */
import { supabaseAdmin } from "@/lib/supabase";
import type { StaffPayload } from "@/lib/auth-server";

const MAX_DETAIL_LEN = 4000;

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim().slice(0, 64);
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim().slice(0, 64);
  return null;
}

function getUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 200) : null;
}

function safeDetails(details: unknown): unknown {
  if (details === null || details === undefined) return null;
  try {
    const s = JSON.stringify(details);
    if (s.length <= MAX_DETAIL_LEN) return details;
    return { _truncated: true, _length: s.length, preview: s.slice(0, 500) };
  } catch {
    return null;
  }
}

type Severity = "info" | "warn" | "security";

async function write(opts: {
  req: Request;
  staff?: StaffPayload | null;
  action: string;
  target?: string | null;
  severity: Severity;
  details?: unknown;
}) {
  try {
    await supabaseAdmin.from("pos_audit_log").insert({
      user_id: opts.staff?.id ?? null,
      user_name: opts.staff?.name ?? null,
      user_role: opts.staff?.role ?? null,
      action: opts.action,
      target: opts.target ?? null,
      severity: opts.severity,
      ip: getIp(opts.req),
      user_agent: getUserAgent(opts.req),
      details: safeDetails(opts.details),
    });
  } catch (e) {
    console.error("[audit-log] write failed:", e);
  }
}

export async function auditAction(
  req: Request,
  staff: StaffPayload | null | undefined,
  action: string,
  target?: string | null,
  details?: unknown
) {
  return write({ req, staff, action, target, severity: "info", details });
}

export async function auditSecurity(
  req: Request,
  staff: StaffPayload | null | undefined,
  action: string,
  target?: string | null,
  details?: unknown
) {
  return write({ req, staff, action, target, severity: "security", details });
}

export async function auditWarn(
  req: Request,
  staff: StaffPayload | null | undefined,
  action: string,
  target?: string | null,
  details?: unknown
) {
  return write({ req, staff, action, target, severity: "warn", details });
}
