import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { tableCreateSchema, tablePatchSchema } from "@/lib/schemas";
import { requireAuth, checkRole } from "@/lib/auth-server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pos_tables")
    .select("*")
    .order("number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables: data });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = checkRole(auth, "chef");
  if (denied) return denied;
  const parsed = await validateJson(req, tableCreateSchema);
  if (isValidationError(parsed)) return parsed;
  const { number, name, capacity } = parsed;
  const { data, error } = await supabaseAdmin
    .from("pos_tables")
    .insert({ number, name, capacity: capacity || 4, status: "free" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const parsed = await validateJson(req, tablePatchSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, ...update } = parsed;
  // Status-Updates (FREE/OCCUPIED) duerfen alle, Layout-Aenderungen nur chef
  const isLayoutChange =
    update.number !== undefined ||
    update.name !== undefined ||
    update.capacity !== undefined;
  if (isLayoutChange && auth.role !== "chef") {
    return NextResponse.json(
      { error: "Nur Chef darf Tisch-Layout aendern" },
      { status: 403 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("pos_tables")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ table: data });
}

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
  const { error } = await supabaseAdmin.from("pos_tables").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
