import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { staffPostSchema, staffPatchSchema } from "@/lib/schemas";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .select("*")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function POST(req: NextRequest) {
  const parsed = await validateJson(req, staffPostSchema);
  if (isValidationError(parsed)) return parsed;

  // Login with PIN (discriminated by action='login')
  if ("action" in parsed && parsed.action === "login") {
    const { pin } = parsed;
    const { data, error } = await supabaseAdmin
      .from("pos_staff")
      .select("*")
      .eq("pin", pin)
      .eq("is_active", true)
      .single();
    if (error || !data) return NextResponse.json({ error: "Falscher PIN" }, { status: 401 });
    return NextResponse.json({ staff: data });
  }

  // Create new staff
  const { name, role, pin } = parsed as { name: string; role: string; pin: string };
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .insert({ name, role, pin, is_active: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function PATCH(req: NextRequest) {
  const parsed = await validateJson(req, staffPatchSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, ...update } = parsed;
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("pos_staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
