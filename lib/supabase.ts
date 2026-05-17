import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(url, anon);
export const supabaseAdmin = createClient(url, service);

/**
 * OFFLINE SYNC UTILITY
 * Manages local storage of orders when internet is unavailable
 */
export const OfflineSync = {
  QUEUE_KEY: 'openclaw_order_queue',

  // Add order to local queue
  async enqueueOrder(order: any) {
    const queue = this.getQueue();
    queue.push({ ...order, timestamp: new Date().toISOString(), synced: false });
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    console.log('[OfflineSync] Order queued locally');
  },

  // Get all pending orders
  getQueue() {
    const data = localStorage.getItem(this.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Sync queued orders to Supabase
  async syncOrders() {
    if (!navigator.onLine) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineSync] Syncing ${queue.length} pending orders...`);
    
    const results = await Promise.all(
      queue.map(async (order: any) => {
        try {
          const { error } = await supabase.from('pos_orders').insert(order);
          if (error) throw error;
          return { id: order.id, success: true };
        } catch (e) {
          return { id: order.id, success: false, error: e };
        }
      })
    );

    const remaining = queue.filter((_: any, index: number) => !results[index].success);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));
    console.log(`[OfflineSync] Sync complete. ${queue.length - remaining.length} synced, ${remaining.length} failed.`);
  },

  // Setup listener for connectivity changes
  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncOrders());
    }
  }
};

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
  is_takeaway?: boolean;
  created_at: string;
  paid_at?: string;
  order_items?: OrderItem[];
}

export interface Reservation {
  id: string;
  guest_name: string;
  guest_phone?: string;
  guest_count: number;
  table_id?: string;
  table_number?: number;
  date: string;
  time: string;
  note?: string;
  status: "confirmed" | "cancelled" | "arrived";
  created_at: string;
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
