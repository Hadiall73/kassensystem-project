import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { orderCreateSchema, orderPatchSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tableId = searchParams.get("table_id");

  let query = supabaseAdmin
    .from("pos_orders")
    .select("*, order_items:pos_order_items(*)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (tableId) query = query.eq("table_id", tableId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}

export async function POST(req: NextRequest) {
  const parsed = await validateJson(req, orderCreateSchema);
  if (isValidationError(parsed)) return parsed;
  const { table_id, table_number, staff_name, note, items } = parsed;

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("pos_orders")
    .insert({ table_id, table_number, staff_name, note, total, status: "open" })
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  const orderItems = items.map((i) => ({
    order_id: order.id,
    menu_item_id: i.menu_item_id,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    note: i.note || null,
    status: "pending",
  }));

  const { error: itemsErr } = await supabaseAdmin.from("pos_order_items").insert(orderItems);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Mark table as occupied
  if (table_id) {
    await supabaseAdmin.from("pos_tables").update({ status: "occupied" }).eq("id", table_id);
  }

  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest) {
  const parsed = await validateJson(req, orderPatchSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, status, payment_method, item_id, item_status } = parsed;

  if (item_id && item_status) {
    const { error } = await supabaseAdmin
      .from("pos_order_items")
      .update({ status: item_status })
      .eq("id", item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (payment_method) update.payment_method = payment_method;
  if (status === "paid") update.paid_at = new Date().toISOString();

  const { data: order, error } = await supabaseAdmin
    .from("pos_orders")
    .update(update)
    .eq("id", id!)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Free up table when paid
  if (status === "paid" && order.table_id) {
    const { data: openOrders } = await supabaseAdmin
      .from("pos_orders")
      .select("id")
      .eq("table_id", order.table_id)
      .neq("status", "paid");
    if (!openOrders || openOrders.length === 0) {
      await supabaseAdmin.from("pos_tables").update({ status: "free" }).eq("id", order.table_id);
    }
  }

  return NextResponse.json({ order });
}
