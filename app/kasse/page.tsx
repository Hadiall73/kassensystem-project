"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Minus, Trash2, Send, CreditCard, Banknote, X, ChefHat, Clock, CheckCircle } from "lucide-react";
import type { PosTable, MenuItem, Category, Order, OrderItem } from "@/lib/supabase";
import { OfflineSync } from "@/lib/supabase";
import { api } from "@/lib/api-client";

interface CartItem { menu_item_id: string; name: string; price: number; quantity: number; note?: string; }

export default function KassePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"tables" | "order">("tables");

  useEffect(() => {
    const s = sessionStorage.getItem("pos_staff");
    if (!s) { router.replace("/login"); return; }
    const parsed = JSON.parse(s);
    if (parsed.role === "chef") { router.replace("/chef"); return; }
    if (parsed.role === "kueche") { router.replace("/kueche"); return; }
    setStaff(parsed);
    loadData();
  }, []);

  async function loadData() {
    const [tabRes, menuRes] = await Promise.all([
      api("/api/tables").then(r => r.json()),
      api("/api/menu").then(r => r.json()),
    ]);
    setTables(tabRes.tables || []);
    setCategories(menuRes.categories || []);
    setMenuItems(menuRes.items || []);
  }

  async function selectTable(t: PosTable) {
    setSelectedTable(t);
    setCart([]);
    setView("order");
    const res = await api(`/api/orders?table_id=${t.id}`);
    const json = await res.json();
    setTableOrders((json.orders || []).filter((o: Order) => o.status !== "paid"));
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item_id === item.id);
      if (existing) return prev.map(c => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item_id === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.menu_item_id !== id);
      return prev.map(c => c.menu_item_id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  }

  async function sendOrder() {
    if (!selectedTable || cart.length === 0) return;
    setLoading(true);

    const orderPayload = {
      table_id: selectedTable.id,
      table_number: selectedTable.number,
      staff_name: staff?.name,
      items: cart,
    };

    try {
      const res = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) throw new Error("Server Error");
      
      setCart([]);
      setLoading(false);
      await selectTable(selectedTable);
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "occupied" } : t));
    } catch (e) {
      console.error("Order send failed, queuing locally...", e);
      await OfflineSync.enqueueOrder(orderPayload);
      setCart([]);
      setLoading(false);
      // Let the user know it's queued (Optional: you can add a toast here)
      alert("Internet weg! Bestellung wurde lokal gespeichert und wird automatisch synchronisiert, sobald du wieder online bist.");
      await selectTable(selectedTable);
    }
  }

  async function payOrder(orderId: string, method: "cash" | "card") {
    setLoading(true);
    await api("/api/orders", {
      method: "PATCH",
      body: JSON.stringify({ id: orderId, status: "paid", payment_method: method }),
    });
    await selectTable(selectedTable!);
    setLoading(false);
    setShowPayment(false);
  }

  const filteredItems = activeCategory === "all"
    ? menuItems.filter(i => i.is_available)
    : menuItems.filter(i => i.category_id === activeCategory && i.is_available);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tableTotal = tableOrders.reduce((s, o) => s + Number(o.total), 0);

  const statusColor = (s: string) => s === "free" ? "border-green-500/40 bg-green-500/5" : s === "occupied" ? "border-orange-500/40 bg-orange-500/10" : "border-blue-500/40 bg-blue-500/10";
  const statusDot = (s: string) => s === "free" ? "bg-green-500" : s === "occupied" ? "bg-orange-500" : "bg-blue-400";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === "order" && (
            <button onClick={() => { setView("tables"); setSelectedTable(null); }}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
              <X size={18} />
            </button>
          )}
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-sm">🍽️</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">
              {view === "order" && selectedTable ? `Tisch ${selectedTable.number}` : "Kassensystem"}
            </p>
            <p className="text-gray-500 text-xs">{staff?.name} · Kellner</p>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem("pos_staff"); sessionStorage.removeItem("pos_staff_token"); router.replace("/login"); }}
          className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
          <LogOut size={16} />
        </button>
      </header>

      {view === "tables" ? (
        /* Table Grid */
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold">Tischübersicht</h2>
            <button onClick={loadData} className="text-gray-500 text-xs hover:text-white transition-colors">Aktualisieren</button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {tables.map(t => (
              <button key={t.id} onClick={() => selectTable(t)}
                className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${statusColor(t.status)}`}>
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusDot(t.status)}`} />
                <p className="text-white font-black text-2xl">{t.number}</p>
                {t.name && <p className="text-gray-400 text-xs mt-0.5">{t.name}</p>}
                <p className="text-gray-500 text-xs">{t.status === "free" ? "Frei" : t.status === "occupied" ? "Besetzt" : "Reserviert"}</p>
              </button>
            ))}
          </div>
          {tables.length === 0 && (
            <div className="text-center py-20 text-gray-600">
              <p>Keine Tische konfiguriert.</p>
              <p className="text-sm mt-1">Chef muss Tische anlegen.</p>
            </div>
          )}
        </div>
      ) : (
        /* Order View */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Menu */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Categories */}
            <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-800">
              <button onClick={() => setActiveCategory("all")}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeCategory === "all" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                Alle
              </button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeCategory === c.id ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.menu_item_id === item.id);
                return (
                  <button key={item.id} onClick={() => addToCart(item)}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${inCart ? "border-orange-500 bg-orange-500/10" : "border-gray-800 bg-gray-900 hover:border-gray-700"}`}>
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    <p className="text-white font-semibold text-sm leading-tight">{item.name}</p>
                    {item.description && <p className="text-gray-500 text-xs mt-1 line-clamp-1">{item.description}</p>}
                    <p className="text-orange-400 font-bold mt-2">{Number(item.price).toFixed(2)} €</p>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-600">Keine Artikel</div>
              )}
            </div>
          </div>

          {/* Right: Cart + Existing Orders */}
          <div className="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col max-h-[50vh] lg:max-h-full">
            {/* Existing orders on this table */}
            {tableOrders.length > 0 && (
              <div className="border-b border-gray-800 p-3">
                <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">Laufende Bestellungen</p>
                {tableOrders.map(order => (
                  <div key={order.id} className="bg-gray-800 rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        order.status === "open" ? "bg-blue-500/20 text-blue-400" :
                        order.status === "cooking" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>
                        {order.status === "open" ? "Offen" : order.status === "cooking" ? "In Zubereitung" : "Fertig"}
                      </span>
                      <span className="text-white font-bold text-sm">{Number(order.total).toFixed(2)} €</span>
                    </div>
                    {order.order_items?.map((item: OrderItem) => (
                      <p key={item.id} className="text-gray-400 text-xs">{item.quantity}x {item.name}</p>
                    ))}
                    {order.status === "ready" && (
                      <button onClick={() => { setShowPayment(true); }}
                        className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors">
                        Bezahlen
                      </button>
                    )}
                    {order.status !== "ready" && (
                      <button onClick={() => setShowPayment(true)}
                        className="mt-2 w-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold py-1.5 rounded-lg transition-colors">
                        Jetzt bezahlen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Cart */}
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">Neue Bestellung</p>
              {cart.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">Artikel aus Karte wählen</p>
              ) : (
                cart.map(item => (
                  <div key={item.menu_item_id} className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{item.name}</p>
                      <p className="text-gray-500 text-xs">{(item.price * item.quantity).toFixed(2)} €</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeFromCart(item.menu_item_id)}
                        className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center">
                        <Minus size={12} />
                      </button>
                      <span className="text-white text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart({ id: item.menu_item_id, name: item.name, price: item.price } as MenuItem)}
                        className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Send Order */}
            {cart.length > 0 && (
              <div className="p-3 border-t border-gray-800">
                <div className="flex justify-between mb-3">
                  <span className="text-gray-400">Gesamt</span>
                  <span className="text-white font-bold">{cartTotal.toFixed(2)} €</span>
                </div>
                <button onClick={sendOrder} disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                  <Send size={16} /> An Küche senden
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Bezahlung — Tisch {selectedTable.number}</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm">Gesamtbetrag</p>
              <p className="text-white text-4xl font-black mt-1">{tableTotal.toFixed(2)} €</p>
            </div>
            {tableOrders.filter(o => o.status !== "paid").map(order => (
              <div key={order.id} className="space-y-3 mb-4">
                <p className="text-gray-500 text-xs text-center">Bestellung vom {new Date(order.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                <button onClick={() => payOrder(order.id, "cash")} disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 text-lg transition-all">
                  <Banknote size={22} /> Bar — {Number(order.total).toFixed(2)} €
                </button>
                <button onClick={() => payOrder(order.id, "card")} disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 text-lg transition-all">
                  <CreditCard size={22} /> Karte — {Number(order.total).toFixed(2)} €
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
