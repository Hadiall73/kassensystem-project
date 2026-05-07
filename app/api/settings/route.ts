import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pos_settings")
    .select("*")
    .single();
  if (error) {
    // Create default settings if none exist
    const { data: created } = await supabaseAdmin
      .from("pos_settings")
      .insert({ restaurant_name: "Mein Restaurant", table_count: 10, currency: "EUR" })
      .select()
      .single();
    return NextResponse.json({ settings: created });
  }
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...update } = body;
  const { data, error } = await supabaseAdmin
    .from("pos_settings")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
