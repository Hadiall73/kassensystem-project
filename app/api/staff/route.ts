import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .select("*")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Login with PIN
  if (body.action === "login") {
    const { pin } = body;
    const { data, error } = await supabaseAdmin
      .from("pos_staff")
      .select("*")
      .eq("pin", pin)
      .eq("is_active", true)
      .single();
    if (error || !data) return NextResponse.json({ error: "Falscher PIN" }, { status: 401 });
    return NextResponse.json({ staff: data });
  }

  const { name, role, pin } = body;
  const { data, error } = await supabaseAdmin
    .from("pos_staff")
    .insert({ name, role, pin, is_active: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...update } = body;
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
  const { error } = await supabaseAdmin.from("pos_staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
