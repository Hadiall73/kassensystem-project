/**
 * Validation Helper für Next.js API Routes (Layer 3 – Input Firewall)
 *
 * Nutzt zod-Schemas. Liefert NextResponse mit 400 bei Validation-Fehler.
 *
 * Verwendung:
 *   const parsed = await validateJson(req, orderCreateSchema);
 *   if (parsed instanceof NextResponse) return parsed; // = Validation-Fehler
 *   const data = parsed; // saubere, getypte Daten
 */
import { NextResponse } from "next/server";
import type { ZodTypeAny, infer as ZInfer } from "zod";
import { ZodError } from "zod";

export async function validateJson<T extends ZodTypeAny>(
  req: Request,
  schema: T
): Promise<ZInfer<T> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  try {
    return schema.parse(body) as ZInfer<T>;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validierung fehlgeschlagen",
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

export function validateSearchParams<T extends ZodTypeAny>(
  url: string,
  schema: T
): ZInfer<T> | NextResponse {
  const { searchParams } = new URL(url);
  const obj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  try {
    return schema.parse(obj) as ZInfer<T>;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Ungueltige Query-Parameter",
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

/** Type-Guard: prüft ob Helper eine Fehler-Response zurückgegeben hat */
export function isValidationError(r: unknown): r is NextResponse {
  return r instanceof NextResponse;
}
