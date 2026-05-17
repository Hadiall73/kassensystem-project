import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { reservationCreateSchema, reservationPatchSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date   = searchParams.get("date");   // YYYY-MM-DD oder "today"/"tomorrow"
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("pos_reservations")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (date === "today") {
    const today = new Date().toISOString().slice(0, 10);
    query = query.eq("date", today);
  } else if (date === "tomorrow") {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    query = query.eq("date", tomorrow);
  } else if (date) {
    query = query.eq("date", date);
  }

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reservations: data });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = await validateJson(req, reservationCreateSchema);
  if (isValidationError(parsed)) return parsed;

  const { data, error } = await supabaseAdmin
    .from("pos_reservations")
    .insert({ ...parsed, status: "confirmed" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tisch als reserviert markieren wenn angegeben
  if (parsed.table_id) {
    await supabaseAdmin
      .from("pos_tables")
      .update({ status: "reserved" })
      .eq("id", parsed.table_id);
  }

  return NextResponse.json({ reservation: data });
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = await validateJson(req, reservationPatchSchema);
  if (isValidationError(parsed)) return parsed;

  const { id, ...update } = parsed;

  const { data, error } = await supabaseAdmin
    .from("pos_reservations")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Wenn Reservierung storniert/angekommen → Tisch ggf. freigeben
  if (update.status === "cancelled" && data.table_id) {
    const { data: upcoming } = await supabaseAdmin
      .from("pos_reservations")
      .select("id")
      .eq("table_id", data.table_id)
      .eq("status", "confirmed")
      .neq("id", id);
    if (!upcoming || upcoming.length === 0) {
      await supabaseAdmin.from("pos_tables").update({ status: "free" }).eq("id", data.table_id);
    }
  }

  return NextResponse.json({ reservation: data });
}
