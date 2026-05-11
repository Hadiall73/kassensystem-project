import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { staffPostSchema, staffPatchSchema } from "@/lib/schemas";
import { requireAuth, checkRole, issueStaffToken } from "@/lib/auth-server";
import { auditAction, auditSecurity } from "@/lib/audit-log";

/**
 * GET /api/staff — Liste aller Mitarbeiter (NUR chef-Rolle, ohne PIN)
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = checkRole(auth, "chef");
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .select("id, name, role, is_active, created_at") // PIN niemals ausgeben
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

/**
 * POST /api/staff
 *  - { action: 'login', pin } → JWT-Token zurueck (offen, kein Auth noetig)
 *  - { name, role, pin }      → neuer Mitarbeiter (NUR chef)
 */
export async function POST(req: NextRequest) {
  const parsed = await validateJson(req, staffPostSchema);
  if (isValidationError(parsed)) return parsed;

  // Login (kein Auth erforderlich)
  if ("action" in parsed && parsed.action === "login") {
    const { pin } = parsed;
    const { data, error } = await supabaseAdmin
      .from("pos_staff")
      .select("*")
      .eq("pin", pin)
      .eq("is_active", true)
      .single();
    if (error || !data) {
      auditSecurity(req, null, "LOGIN_FAILED", null, {
        reason: "wrong_pin",
        pinPrefix: pin?.slice(0, 1) + "***",
      });
      return NextResponse.json({ error: "Falscher PIN" }, { status: 401 });
    }
    const token = issueStaffToken({
      id: data.id,
      name: data.name,
      role: data.role,
    });
    auditAction(req, { id: data.id, name: data.name, role: data.role, type: "access" }, "LOGIN_SUCCESS", `Staff#${data.id}`, {
      role: data.role,
    });
    return NextResponse.json({
      staff: { id: data.id, name: data.name, role: data.role },
      token,
      expiresIn: "1h",
    });
  }

  // Create (chef-only)
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = checkRole(auth, "chef");
  if (denied) return denied;

  const { name, role, pin } = parsed as { name: string; role: string; pin: string };
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .insert({ name, role, pin, is_active: true })
    .select("id, name, role, is_active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  auditAction(req, auth, "CREATE_STAFF", `Staff#${data.id}`, { name, role });
  return NextResponse.json({ staff: data });
}

/** PATCH (chef-only, kein Self-Update via Selbstdeaktivierung) */
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = checkRole(auth, "chef");
  if (denied) return denied;

  const parsed = await validateJson(req, staffPatchSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, ...update } = parsed;

  // preventSelf-Logic: chef kann sich nicht selbst deaktivieren / Rolle entziehen
  if (id === auth.id && (update.is_active === false || update.role !== undefined)) {
    return NextResponse.json(
      { error: "Aktion auf eigenen Account nicht erlaubt" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .update(update)
    .eq("id", id)
    .select("id, name, role, is_active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  auditAction(req, auth, "UPDATE_STAFF", `Staff#${id}`, update);
  return NextResponse.json({ staff: data });
}

/** DELETE (chef-only, nicht sich selbst) */
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = checkRole(auth, "chef");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }
  if (id === auth.id) {
    return NextResponse.json(
      { error: "Aktion auf eigenen Account nicht erlaubt" },
      { status: 400 }
    );
  }
  const { error } = await supabaseAdmin.from("pos_staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  auditAction(req, auth, "DELETE_STAFF", `Staff#${id}`, {});
  return NextResponse.json({ ok: true });
}
