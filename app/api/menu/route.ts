import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { menuCreateSchema, menuPatchSchema } from "@/lib/schemas";
import { requireAuth, checkRole } from "@/lib/auth-server";

function requireChef(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return checkRole(auth, "chef") || auth;
}

export async function GET() {
  const [cats, items] = await Promise.all([
    supabaseAdmin.from("pos_categories").select("*").order("sort_order"),
    supabaseAdmin.from("pos_menu_items").select("*").order("sort_order"),
  ]);
  return NextResponse.json({ categories: cats.data || [], items: items.data || [] });
}

export async function POST(req: NextRequest) {
  const auth = requireChef(req);
  if (auth instanceof NextResponse) return auth;
  const parsed = await validateJson(req, menuCreateSchema);
  if (isValidationError(parsed)) return parsed;
  const { type, ...data } = parsed;

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
  const auth = requireChef(req);
  if (auth instanceof NextResponse) return auth;
  const parsed = await validateJson(req, menuPatchSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, type, ...update } = parsed;

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
  const auth = requireChef(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }
  if (type !== "category" && type !== "item") {
    return NextResponse.json({ error: "type muss 'category' oder 'item' sein" }, { status: 400 });
  }
  const table = type === "category" ? "pos_categories" : "pos_menu_items";
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
