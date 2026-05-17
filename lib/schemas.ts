/**
 * Zod-Schemas für alle kassensystem API-Routes.
 * Konventionen identisch zu restaurant-pos/server/src/schemas/index.js.
 */
import { z } from "zod";

/* ── Building Blocks ─────────────────────────────────────────────── */

const safeString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen`)
    .transform((s) => s.replace(/<[^>]*>/g, ""));

const id = z
  .string()
  .trim()
  .min(1, "ID erforderlich")
  .max(64, "ID zu lang");

const positiveNumber = z.number().refine((n) => Number.isFinite(n) && n >= 0, "Positive Zahl");
const positiveInt = z.number().int().positive();

const ORDER_STATUS = ["open", "preparing", "ready", "served", "paid", "cancelled"] as const;
const ITEM_STATUS = ["pending", "preparing", "ready", "served"] as const;
const STAFF_ROLES = ["chef", "kellner", "kueche"] as const;
const TABLE_STATUS = ["free", "occupied", "reserved"] as const;
const PAYMENT_METHODS = ["cash", "card", "voucher"] as const;

/* ── Orders ──────────────────────────────────────────────────────── */
export const orderItemSchema = z.object({
  menu_item_id: id.optional(),
  name: safeString(120),
  price: positiveNumber,
  quantity: positiveInt,
  note: safeString(300).nullish(),
});

export const orderCreateSchema = z.object({
  table_id: id.nullish(),
  table_number: z.union([z.string(), z.number()]).optional(),
  staff_name: safeString(80).optional(),
  note: safeString(300).nullish(),
  is_takeaway: z.boolean().optional(),
  items: z.array(orderItemSchema).min(1).max(100),
});

export const orderPatchSchema = z
  .object({
    id: id.optional(),
    status: z.enum(ORDER_STATUS).optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    item_id: id.optional(),
    item_status: z.enum(ITEM_STATUS).optional(),
  })
  .refine(
    (o) =>
      // entweder Order-Update (id + something) oder Item-Update (item_id + item_status)
      (o.id && (o.status || o.payment_method)) || (o.item_id && o.item_status),
    "id+status/payment_method ODER item_id+item_status erforderlich"
  );

/* ── Menu ────────────────────────────────────────────────────────── */
export const categoryCreateSchema = z.object({
  type: z.literal("category"),
  name: safeString(80),
  sort_order: z.number().int().nonnegative().optional(),
});

export const menuItemCreateSchema = z.object({
  type: z.literal("item").optional(),
  name: safeString(120),
  description: safeString(500).nullish(),
  price: positiveNumber,
  category_id: id.optional(),
  sort_order: z.number().int().nonnegative().optional(),
  is_available: z.boolean().optional(),
});

export const menuCreateSchema = z.discriminatedUnion("type", [
  categoryCreateSchema,
  menuItemCreateSchema.extend({ type: z.literal("item") }),
]);

export const menuPatchSchema = z
  .object({
    id: id,
    type: z.enum(["category", "item"]).optional(),
    name: safeString(120).optional(),
    description: safeString(500).nullish(),
    price: positiveNumber.optional(),
    category_id: id.optional(),
    sort_order: z.number().int().nonnegative().optional(),
    is_available: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 1, "Mindestens ein Feld neben id");

/* ── Staff ───────────────────────────────────────────────────────── */
export const staffLoginSchema = z.object({
  action: z.literal("login"),
  pin: z.string().regex(/^\d{4,8}$/, "PIN muss 4-8 Ziffern sein"),
});

export const staffCreateSchema = z.object({
  action: z.undefined().optional(),
  name: safeString(80),
  role: z.enum(STAFF_ROLES),
  pin: z.string().regex(/^\d{4,8}$/, "PIN muss 4-8 Ziffern sein"),
});

export const staffPostSchema = z.union([staffLoginSchema, staffCreateSchema]);

export const staffPatchSchema = z
  .object({
    id: id,
    name: safeString(80).optional(),
    role: z.enum(STAFF_ROLES).optional(),
    pin: z.string().regex(/^\d{4,8}$/).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 1, "Mindestens ein Feld neben id");

/* ── Tables ──────────────────────────────────────────────────────── */
export const tableCreateSchema = z.object({
  number: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? parseInt(v, 10) : v
  ).pipe(positiveInt),
  name: safeString(40).optional(),
  capacity: positiveInt.optional(),
});

export const tablePatchSchema = z
  .object({
    id: id,
    number: positiveInt.optional(),
    name: safeString(40).optional(),
    capacity: positiveInt.optional(),
    status: z.enum(TABLE_STATUS).optional(),
  })
  .refine((o) => Object.keys(o).length > 1, "Mindestens ein Feld neben id");

/* ── Reservierungen ──────────────────────────────────────────────── */
const RESERVATION_STATUS = ["confirmed", "cancelled", "arrived"] as const;

export const reservationCreateSchema = z.object({
  guest_name:   safeString(120),
  guest_phone:  safeString(30).optional(),
  guest_count:  positiveInt,
  table_id:     id.optional(),
  table_number: z.union([z.string(), z.number()]).optional(),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format YYYY-MM-DD"),
  time:         z.string().regex(/^\d{2}:\d{2}$/, "Zeit im Format HH:MM"),
  note:         safeString(300).nullish(),
});

export const reservationPatchSchema = z.object({
  id:     id,
  status: z.enum(RESERVATION_STATUS).optional(),
  note:   safeString(300).nullish(),
}).refine((o) => Object.keys(o).length > 1, "Mindestens ein Feld neben id");

/* ── Settings ────────────────────────────────────────────────────── */
export const settingsPatchSchema = z.object({
  restaurant_name: safeString(120).optional(),
  tax_rate: z.number().min(0).max(1).optional(),
  currency: safeString(8).optional(),
  receipt_footer: safeString(500).optional(),
});
