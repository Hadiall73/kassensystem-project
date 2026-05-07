import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data: orders, error } = await supabaseAdmin
    .from("pos_orders")
    .select("*, order_items:pos_order_items(*)")
    .eq("status", "paid")
    .gte("paid_at", start)
    .lte("paid_at", end);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = orders?.reduce((s, o) => s + Number(o.total), 0) || 0;
  const cash = orders?.filter(o => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0) || 0;
  const card = orders?.filter(o => o.payment_method === "card").reduce((s, o) => s + Number(o.total), 0) || 0;
  const count = orders?.length || 0;

  return NextResponse.json({ date, total, cash, card, count, orders });
}
