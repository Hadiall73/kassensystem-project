"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, ChefHat, LogOut, Bell } from "lucide-react";
import type { Order, OrderItem } from "@/lib/supabase";
import { api } from "@/lib/api-client";

export default function KuechePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = sessionStorage.getItem("pos_staff");
    if (!s) { router.replace("/login"); return; }
    const parsed = JSON.parse(s);
    if (parsed.role === "kellner") { router.replace("/kasse"); return; }
    if (parsed.role === "chef") { router.replace("/chef"); return; }
    setStaff(parsed);
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = useCallback(async () => {
    const res = await api("/api/orders?status=open");
    const json = await res.json();
    const cooking = await api("/api/orders?status=cooking");
    const cookingJson = await cooking.json();
    setOrders([...(json.orders || []), ...(cookingJson.orders || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ));
  }, []);

  async function markCooking(orderId: string) {
    await api("/api/orders", {
      method: "PATCH",
      body: JSON.stringify({ id: orderId, status: "cooking" }),
    });
    loadOrders();
  }

  async function markReady(orderId: string) {
    await api("/api/orders", {
      method: "PATCH",
      body: JSON.stringify({ id: orderId, status: "ready" }),
    });
    loadOrders();
  }

  async function markItemDone(itemId: string) {
    await api("/api/orders", {
      method: "PATCH",
      body: JSON.stringify({ item_id: itemId, item_status: "done" }),
    });
    loadOrders();
  }

  function elapsed(created: string) {
    const mins = Math.floor((Date.now() - new Date(created).getTime()) / 60000);
    return mins < 1 ? "Gerade" : `${mins} min`;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
            <ChefHat size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Küchen-Display</p>
            <p className="text-gray-500 text-xs">{staff?.name} · Automatisch aktualisiert</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${orders.length > 0 ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"}`}>
            {orders.length} offen
          </span>
          <button onClick={() => { sessionStorage.removeItem("pos_staff"); sessionStorage.removeItem("pos_staff_token"); router.replace("/login"); }}
            className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-32 text-center">
            <CheckCircle size={64} className="text-green-500 mb-4" />
            <h2 className="text-white text-2xl font-bold">Alles erledigt!</h2>
            <p className="text-gray-500 mt-2">Keine offenen Bestellungen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => (
              <div key={order.id}
                className={`bg-gray-900 rounded-2xl border-2 overflow-hidden ${order.status === "cooking" ? "border-yellow-500/50" : "border-orange-500/50"}`}>
                {/* Order Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${order.is_takeaway ? "bg-purple-500/20" : order.status === "cooking" ? "bg-yellow-500/10" : "bg-orange-500/10"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-black text-lg">
                        {order.is_takeaway ? "🥡 AUSSER HAUS" : `Tisch ${order.table_number}`}
                      </p>
                    </div>
                    {order.is_takeaway && order.table_number && (
                      <p className="text-purple-300 text-xs">Tisch {order.table_number}</p>
                    )}
                    <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                      <Clock size={12} />
                      <span>{elapsed(order.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {order.is_takeaway && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/50">
                        🥡 Mitnehmen
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${order.status === "cooking" ? "bg-yellow-500/20 text-yellow-400" : "bg-orange-500/20 text-orange-400"}`}>
                      {order.status === "cooking" ? "In Zubereitung" : "Neu"}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 space-y-2">
                  {order.order_items?.map((item: OrderItem) => (
                    <div key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-xl transition-all ${item.status === "done" ? "opacity-40" : ""}`}>
                      <button onClick={() => markItemDone(item.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${item.status === "done" ? "bg-green-500 border-green-500" : "border-gray-600 hover:border-green-500"}`}>
                        {item.status === "done" && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${item.status === "done" ? "line-through text-gray-600" : "text-white"}`}>
                          {item.quantity}× {item.name}
                        </p>
                        {item.note && <p className="text-yellow-400 text-xs">! {item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 space-y-2">
                  {order.status === "open" && (
                    <button onClick={() => markCooking(order.id)}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2.5 rounded-xl font-bold text-sm transition-all">
                      In Zubereitung
                    </button>
                  )}
                  {order.status === "cooking" && (
                    <button onClick={() => markReady(order.id)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <Bell size={16} /> Fertig — Kellner rufen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
