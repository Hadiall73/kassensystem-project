"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut, Plus, Minus, Send, CreditCard, Banknote, X,
  Clock, CalendarDays, ShoppingBag, Users, Phone, ChevronLeft,
  CheckCircle, Ban,
} from "lucide-react";
import type { PosTable, MenuItem, Category, Order, OrderItem, Reservation } from "@/lib/supabase";
import { OfflineSync } from "@/lib/supabase";
import { api } from "@/lib/api-client";

interface CartItem { menu_item_id: string; name: string; price: number; quantity: number; note?: string; }

type MainView = "tables" | "order" | "reservierungen";

const TODAY    = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function KassePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);

  const [tables, setTables]         = useState<PosTable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);

  const [view, setView]                 = useState<MainView>("tables");
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [tableOrders, setTableOrders]       = useState<Order[]>([]);
  const [isAusserHaus, setIsAusserHaus]     = useState(false);
  const [showPayment, setShowPayment]       = useState(false);
  const [loading, setLoading]               = useState(false);

  const [reservations, setReservations]   = useState<Reservation[]>([]);
  const [reservDate, setReservDate]       = useState<string>(TODAY);
  const [showNewReserv, setShowNewReserv] = useState(false);
  const [reservForm, setReservForm] = useState({
    guest_name: "", guest_phone: "", guest_count: 2,
    table_id: "", date: TODAY, time: "19:00", note: "",
  });

  useEffect(() => {
    const s = sessionStorage.getItem("pos_staff");
    if (!s) { router.replace("/login"); return; }
    const parsed = JSON.parse(s);
    if (parsed.role === "chef")   { router.replace("/chef");   return; }
    if (parsed.role === "kueche") { router.replace("/kueche"); return; }
    setStaff(parsed);
    loadData();
    OfflineSync.init();
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

  const loadReservations = useCallback(async (date: string) => {
    const param = date === TODAY ? "today" : date === TOMORROW ? "tomorrow" : date;
    const res = await api(`/api/reservations?date=${param}`);
    const json = await res.json();
    setReservations(json.reservations || []);
  }, []);

  useEffect(() => {
    if (view === "reservierungen") loadReservations(reservDate);
  }, [view, reservDate]);

  async function selectTable(t: PosTable) {
    setSelectedTable(t);
    setCart([]);
    setIsAusserHaus(false);
    setView("order");
    const res = await api(`/api/orders?table_id=${t.id}`);
    const json = await res.json();
    setTableOrders((json.orders || []).filter((o: Order) => o.status !== "paid"));
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item_id === item.id);
      if (ex) return prev.map(c => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const ex = prev.find(c => c.menu_item_id === id);
      if (!ex) return prev;
      if (ex.quantity === 1) return prev.filter(c => c.menu_item_id !== id);
      return prev.map(c => c.menu_item_id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  }

  async function sendOrder() {
    if (!selectedTable || cart.length === 0) return;
    setLoading(true);
    const payload = {
      table_id: selectedTable.id, table_number: selectedTable.number,
      staff_name: staff?.name, is_takeaway: isAusserHaus, items: cart,
    };
    try {
      const res = await api("/api/orders", { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      setCart([]); setIsAusserHaus(false);
      await selectTable(selectedTable);
      if (!isAusserHaus)
        setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: "occupied" } : t));
    } catch {
      await OfflineSync.enqueueOrder(payload);
      setCart([]);
      alert("Offline! Bestellung lokal gespeichert.");
      await selectTable(selectedTable);
    } finally { setLoading(false); }
  }

  async function payOrder(orderId: string, method: "cash" | "card") {
    setLoading(true);
    await api("/api/orders", { method: "PATCH", body: JSON.stringify({ id: orderId, status: "paid", payment_method: method }) });
    await selectTable(selectedTable!);
    setLoading(false); setShowPayment(false);
  }

  async function saveReservation() {
    if (!reservForm.guest_name || !reservForm.date || !reservForm.time) return;
    setLoading(true);
    await api("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        ...reservForm,
        guest_count: Number(reservForm.guest_count),
        table_id: reservForm.table_id || undefined,
        table_number: reservForm.table_id ? tables.find(t => t.id === reservForm.table_id)?.number : undefined,
      }),
    });
    setShowNewReserv(false);
    setReservForm({ guest_name: "", guest_phone: "", guest_count: 2, table_id: "", date: TODAY, time: "19:00", note: "" });
    await loadReservations(reservDate);
    setLoading(false);
  }

  async function cancelReservation(id: string) {
    await api("/api/reservations", { method: "PATCH", body: JSON.stringify({ id, status: "cancelled" }) });
    await loadReservations(reservDate);
  }

  async function markArrived(id: string) {
    await api("/api/reservations", { method: "PATCH", body: JSON.stringify({ id, status: "arrived" }) });
    await loadReservations(reservDate);
  }

  const filteredItems = activeCategory === "all"
    ? menuItems.filter(i => i.is_available)
    : menuItems.filter(i => i.category_id === activeCategory && i.is_available);

  const cartTotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tableTotal = tableOrders.reduce((s, o) => s + Number(o.total), 0);

  const statusColor = (s: string) =>
    s === "free" ? "border-green-500/40 bg-green-500/5" :
    s === "occupied" ? "border-orange-500/40 bg-orange-500/10" :
    "border-blue-500/40 bg-blue-500/10";
  const statusDot = (s: string) =>
    s === "free" ? "bg-green-500" : s === "occupied" ? "bg-orange-500" : "bg-blue-400";
  const reservColor = (s: string) =>
    s === "confirmed" ? "bg-blue-500/20 text-blue-400 border-blue-500/40" :
    s === "arrived"   ? "bg-green-500/20 text-green-400 border-green-500/40" :
    "bg-gray-700/40 text-gray-500 border-gray-700/40";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === "order" && (
            <button onClick={() => { setView("tables"); setSelectedTable(null); }}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-sm">🍽️</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">
              {view === "order" && selectedTable ? `Tisch ${selectedTable.number}` :
               view === "reservierungen" ? "Reservierungen" : "Kassensystem"}
            </p>
            <p className="text-gray-500 text-xs">{staff?.name} · Kellner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view !== "order" && (
            <>
              <button onClick={() => setView("tables")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${view === "tables" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                Tische
              </button>
              <button onClick={() => setView("reservierungen")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${view === "reservierungen" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                <CalendarDays size={13} /> Reservierungen
              </button>
            </>
          )}
          <button onClick={() => { sessionStorage.removeItem("pos_staff"); sessionStorage.removeItem("pos_staff_token"); router.replace("/login"); }}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── TISCHÜBERSICHT ── */}
      {view === "tables" && (
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
            {tables.length === 0 && (
              <div className="col-span-full text-center py-20 text-gray-600">
                <p>Keine Tische konfiguriert.</p>
                <p className="text-sm mt-1">Chef muss Tische anlegen.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RESERVIERUNGEN ── */}
      {view === "reservierungen" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 p-3 border-b border-gray-800 overflow-x-auto items-center">
            {[{ label: "Heute", value: TODAY }, { label: "Morgen", value: TOMORROW }, { label: "Alle", value: "all" }].map(({ label, value }) => (
              <button key={value} onClick={() => setReservDate(value)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${reservDate === value ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowNewReserv(true)}
              className="ml-auto shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold flex items-center gap-1 transition-all">
              <Plus size={15} /> Neue Reservierung
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {reservations.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <CalendarDays size={48} className="mx-auto mb-3 opacity-30" />
                <p>Keine Reservierungen</p>
                <p className="text-sm mt-1">Klicke auf "Neue Reservierung".</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl mx-auto">
                {reservations.map(r => (
                  <div key={r.id} className={`bg-gray-900 rounded-2xl border border-gray-800 p-4 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-bold">{r.guest_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${reservColor(r.status)}`}>
                            {r.status === "confirmed" ? "Bestätigt" : r.status === "arrived" ? "Angekommen" : "Storniert"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-orange-400 font-bold text-sm"><Clock size={13} /> {r.time} Uhr</span>
                          <span className="flex items-center gap-1 text-gray-400 text-sm"><Users size={13} /> {r.guest_count} Personen</span>
                          {r.table_number && <span className="text-gray-400 text-sm">🪑 Tisch {r.table_number}</span>}
                          {r.guest_phone && <span className="flex items-center gap-1 text-gray-400 text-sm"><Phone size={13} /> {r.guest_phone}</span>}
                        </div>
                        {r.note && <p className="text-yellow-400 text-xs mt-1.5">📝 {r.note}</p>}
                        {reservDate === "all" && (
                          <p className="text-gray-600 text-xs mt-1">
                            {new Date(r.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                          </p>
                        )}
                      </div>
                      {r.status === "confirmed" && (
                        <div className="flex gap-2">
                          <button onClick={() => markArrived(r.id)}
                            className="p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all" title="Angekommen">
                            <CheckCircle size={16} />
                          </button>
                          <button onClick={() => cancelReservation(r.id)}
                            className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all" title="Stornieren">
                            <Ban size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BESTELLANSICHT ── */}
      {view === "order" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Außer Haus Toggle */}
            <div className="px-3 pt-3">
              <button onClick={() => setIsAusserHaus(v => !v)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                  isAusserHaus
                    ? "bg-purple-500/20 border-purple-500 text-purple-300"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                }`}>
                <ShoppingBag size={16} />
                {isAusserHaus ? "🥡 AUSSER HAUS — aktiv (klicken zum deaktivieren)" : "Außer Haus"}
              </button>
            </div>

            {/* Kategorien */}
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

            {/* Menü */}
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
              {filteredItems.length === 0 && <div className="col-span-full text-center py-10 text-gray-600">Keine Artikel</div>}
            </div>
          </div>

          {/* Warenkorb */}
          <div className="w-full lg:w-80 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col max-h-[50vh] lg:max-h-full">
            {tableOrders.length > 0 && (
              <div className="border-b border-gray-800 p-3">
                <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider">Laufende Bestellungen</p>
                {tableOrders.map(order => (
                  <div key={order.id} className={`rounded-xl p-3 mb-2 ${order.is_takeaway ? "bg-purple-900/30 border border-purple-500/30" : "bg-gray-800"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${order.status === "open" ? "bg-blue-500/20 text-blue-400" : order.status === "cooking" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>
                          {order.status === "open" ? "Offen" : order.status === "cooking" ? "In Zubereitung" : "Fertig"}
                        </span>
                        {order.is_takeaway && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">🥡 Außer Haus</span>
                        )}
                      </div>
                      <span className="text-white font-bold text-sm">{Number(order.total).toFixed(2)} €</span>
                    </div>
                    {order.order_items?.map((item: OrderItem) => (
                      <p key={item.id} className="text-gray-400 text-xs">{item.quantity}× {item.name}</p>
                    ))}
                    <button onClick={() => setShowPayment(true)}
                      className={`mt-2 w-full text-xs font-bold py-1.5 rounded-lg transition-colors ${order.status === "ready" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}>
                      {order.status === "ready" ? "Bezahlen ✓" : "Jetzt bezahlen"}
                    </button>
                  </div>
                ))}
              </div>
            )}

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

            {cart.length > 0 && (
              <div className="p-3 border-t border-gray-800">
                <div className="flex justify-between mb-3">
                  <span className="text-gray-400">Gesamt</span>
                  <span className="text-white font-bold">{cartTotal.toFixed(2)} €</span>
                </div>
                {isAusserHaus && (
                  <div className="mb-2 text-center text-purple-300 text-xs font-semibold bg-purple-500/10 rounded-xl py-1.5 border border-purple-500/30">
                    🥡 Wird als AUSSER HAUS an Küche gesendet
                  </div>
                )}
                <button onClick={sendOrder} disabled={loading}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${isAusserHaus ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}>
                  <Send size={16} />
                  {isAusserHaus ? "🥡 Außer Haus — An Küche" : "An Küche senden"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bezahl-Modal */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Bezahlung — Tisch {selectedTable.number}</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm">Gesamtbetrag</p>
              <p className="text-white text-4xl font-black mt-1">{tableTotal.toFixed(2)} €</p>
            </div>
            {tableOrders.filter(o => o.status !== "paid").map(order => (
              <div key={order.id} className="space-y-3 mb-4">
                {order.is_takeaway && <p className="text-purple-400 text-xs text-center font-semibold">🥡 Außer Haus</p>}
                <p className="text-gray-500 text-xs text-center">
                  {new Date(order.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                </p>
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

      {/* Neue Reservierung Modal */}
      {showNewReserv && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Neue Reservierung</h3>
              <button onClick={() => setShowNewReserv(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Name *</label>
                <input value={reservForm.guest_name} onChange={e => setReservForm(f => ({ ...f, guest_name: e.target.value }))}
                  placeholder="Mustermann"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Telefon</label>
                <input value={reservForm.guest_phone} onChange={e => setReservForm(f => ({ ...f, guest_phone: e.target.value }))}
                  placeholder="+49 123 456789" type="tel"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Datum *</label>
                  <input value={reservForm.date} onChange={e => setReservForm(f => ({ ...f, date: e.target.value }))}
                    type="date" min={TODAY}
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Uhrzeit *</label>
                  <input value={reservForm.time} onChange={e => setReservForm(f => ({ ...f, time: e.target.value }))}
                    type="time"
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Personen *</label>
                <input value={reservForm.guest_count} onChange={e => setReservForm(f => ({ ...f, guest_count: Number(e.target.value) }))}
                  type="number" min={1} max={50}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tisch (optional)</label>
                <select value={reservForm.table_id} onChange={e => setReservForm(f => ({ ...f, table_id: e.target.value }))}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500">
                  <option value="">Kein Tisch zugewiesen</option>
                  {tables.filter(t => t.status !== "occupied").map(t => (
                    <option key={t.id} value={t.id}>
                      Tisch {t.number}{t.name ? ` — ${t.name}` : ""}{t.capacity ? ` (${t.capacity} Plätze)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Notiz</label>
                <textarea value={reservForm.note} onChange={e => setReservForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Geburtstag, Allergie, besondere Wünsche..." rows={2}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none" />
              </div>
            </div>
            <button onClick={saveReservation}
              disabled={loading || !reservForm.guest_name || !reservForm.date || !reservForm.time}
              className="mt-5 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
              <CalendarDays size={18} /> Reservierung speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
