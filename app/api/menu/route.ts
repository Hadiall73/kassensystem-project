import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const [cats, items] = await Promise.all([
    supabaseAdmin.from("pos_categories").select("*").order("sort_order"),
    supabaseAdmin.from("pos_menu_items").select("*").order("sort_order"),
  ]);
  return NextResponse.json({ categories: cats.data || [], items: items.data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, ...data } = body;

  if (type === "category") {
    const { data: cat, error } = await supabaseAdmin
      .from("pos_categories")
      .insert(data)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: cat });
  }

  const { data: item, error } = await supabaseAdmin
    .from("pos_menu_items")
    .insert(data)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, type, ...update } = body;

  const table = type === "category" ? "pos_categories" : "pos_menu_items";
  const { data, error } = await supabaseAdmin
    .from(table)
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");
  const table = type === "category" ? "pos_categories" : "pos_menu_items";
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
