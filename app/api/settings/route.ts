import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateJson, isValidationError } from "@/lib/validate";
import { settingsPatchSchema } from "@/lib/schemas";
import { z } from "zod";

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

const settingsPatchWithIdSchema = settingsPatchSchema.extend({
  id: z.string().trim().min(1).max(64),
});

export async function PATCH(req: NextRequest) {
  const parsed = await validateJson(req, settingsPatchWithIdSchema);
  if (isValidationError(parsed)) return parsed;
  const { id, ...update } = parsed;
  const { data, error } = await supabaseAdmin
    .from("pos_settings")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
