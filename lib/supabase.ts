import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(url, anon);
export const supabaseAdmin = createClient(url, service);

export type StaffRole = "chef" | "kellner" | "kueche";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  pin: string;
  is_active: boolean;
}

export interface PosTable {
  id: string;
  number: number;
  name?: string;
  capacity: number;
  status: "free" | "occupied" | "reserved";
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  color: string;
}

export interface MenuItem {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  sort_order: number;
}

export interface Order {
  id: string;
  table_id?: string;
  table_number?: number;
  status: "open" | "cooking" | "ready" | "paid";
  payment_method?: string;
  total: number;
  note?: string;
  staff_name?: string;
  created_at: string;
  paid_at?: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  status: "pending" | "cooking" | "done";
}

export interface PosSettings {
  id: string;
  restaurant_name: string;
  table_count: number;
  currency: string;
}
