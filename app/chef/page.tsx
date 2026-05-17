"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Table2, UtensilsCrossed, Users, BarChart3,
  LogOut, Plus, Trash2, Edit2, Save, X, Check, ChefHat, TrendingUp,
  Banknote, CreditCard, ShoppingBag
} from "lucide-react";
import type { PosTable, Category, MenuItem, Staff, PosSettings } from "@/lib/supabase";
import { api } from "@/lib/api-client";

type Tab = "dashboard" | "tables" | "menu" | "staff" | "settings";

export default function ChefPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Data
  const [tables, setTables] = useState<PosTable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [report, setReport] = useState<any>(null);

  // Forms
  const [newTable, setNewTable] = useState({ number: "", name: "", capacity: "4" });
  const [newCat, setNewCat] = useState({ name: "", color: "#f97316" });
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category_id: "" });
  const [newStaff, setNewStaff] = useState({ name: "", role: "kellner", pin: "" });
  const [editSettings, setEditSettings] = useState({ restaurant_name: "", table_count: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = sessionStorage.getItem("pos_staff");
    if (!s) { router.replace("/login"); return; }
    const parsed = JSON.parse(s);
    if (parsed.role !== "chef") { router.replace("/kasse"); return; }
    setStaff(parsed);
    loadAll();
  }, []);

  async function loadAll() {
    const [tabRes, menuRes, staffRes, settingsRes, reportRes] = await Promise.all([
      api("/api/tables").then(r => r.json()),
      api("/api/menu").then(r => r.json()),
      api("/api/staff").then(r => r.json()),
      api("/api/settings").then(r => r.json()),
      api("/api/reports").then(r => r.json()),
    ]);
    setTables(tabRes.tables || []);
    setCategories(menuRes.categories || []);
    setMenuItems(menuRes.items || []);
    setStaffList(staffRes.staff || []);
    if (settingsRes.settings) {
      setSettings(settingsRes.settings);
      setEditSettings({ restaurant_name: settingsRes.settings.restaurant_name, table_count: String(settingsRes.settings.table_count) });
    }
    setReport(reportRes);
  }

  async function addTable() {
    if (!newTable.number) return;
    setSaving(true);
    await api("/api/tables", {
      method: "POST",
      body: JSON.stringify({ number: parseInt(newTable.number), name: newTable.name || null, capacity: parseInt(newTable.capacity) }),
    });
    setNewTable({ number: "", name: "", capacity: "4" });
    setSaving(false);
    const res = await api("/api/tables").then(r => r.json());
    setTables(res.tables || []);
  }

  async function deleteTable(id: string) {
    await api(`/api/tables?id=${id}`, { method: "DELETE" });
    setTables(prev => prev.filter(t => t.id !== id));
  }

  async function addCategory() {
    if (!newCat.name) return;
    setSaving(true);
    const res = await api("/api/menu", {
      method: "POST",
      body: JSON.stringify({ type: "category", name: newCat.name, color: newCat.color, sort_order: categories.length }),
    });
    const json = await res.json();
    setCategories(prev => [...prev, json.category]);
    setNewCat({ name: "", color: "#f97316" });
    setSaving(false);
  }

  async function deleteCategory(id: string) {
    await api(`/api/menu?id=${id}&type=category`, { method: "DELETE" });
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  async function addMenuItem() {
    if (!newItem.name || !newItem.price) return;
    setSaving(true);
    const res = await api("/api/menu", {
      method: "POST",
      body: JSON.stringify({
        name: newItem.name,
        description: newItem.description || null,
        price: parseFloat(newItem.price),
        category_id: newItem.category_id || null,
        is_available: true,
        sort_order: menuItems.length,
      }),
    });
    const json = await res.json();
    setMenuItems(prev => [...prev, json.item]);
    setNewItem({ name: "", description: "", price: "", category_id: "" });
    setSaving(false);
  }

  async function toggleItemAvailable(item: MenuItem) {
    await api("/api/menu", {
      method: "PATCH",
      body: JSON.stringify({ id: item.id, is_available: !item.is_available }),
    });
    setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  }

  async function deleteMenuItem(id: string) {
    await api(`/api/menu?id=${id}`, { method: "DELETE" });
    setMenuItems(prev => prev.filter(i => i.id !== id));
  }

  async function addStaff() {
    if (!newStaff.name || !newStaff.pin) return;
    setSaving(true);
    const res = await api("/api/staff", {
      method: "POST",
      body: JSON.stringify(newStaff),
    });
    const json = await res.json();
    setStaffList(prev => [...prev, json.staff]);
    setNewStaff({ name: "", role: "kellner", pin: "" });
    setSaving(false);
  }

  async function deleteStaff(id: string) {
    await api(`/api/staff?id=${id}`, { method: "DELETE" });
    setStaffList(prev => prev.filter(s => s.id !== id));
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const res = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ id: settings.id, restaurant_name: editSettings.restaurant_name, table_count: parseInt(editSettings.table_count) }),
    });
    const json = await res.json();
    setSettings(json.settings);
    setSaving(false);
  }

  const NAV: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Übersicht", icon: LayoutDashboard },
    { id: "tables", label: "Tische", icon: Table2 },
    { id: "menu", label: "Speisekarte", icon: UtensilsCrossed },
    { id: "staff", label: "Personal", icon: Users },
    { id: "settings", label: "Einstellungen", icon: ChefHat },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col hidden lg:flex">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ChefHat size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{settings?.restaurant_name || "Restaurant"}</p>
              <p className="text-gray-500 text-xs">Chef</p>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === n.id ? "bg-orange-500 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
                <Icon size={16} /> {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-800 space-y-1">
          <button onClick={() => router.push("/kasse")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-orange-400 hover:bg-orange-500/20 transition-all">
            <ShoppingBag size={16} /> Zur Kasse
          </button>
          <button onClick={() => { sessionStorage.removeItem("pos_staff"); sessionStorage.removeItem("pos_staff_token"); router.replace("/login"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
            <LogOut size={16} /> Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
        {NAV.map(n => {
          const Icon = n.icon;
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-all ${tab === n.id ? "text-orange-500" : "text-gray-500"}`}>
              <Icon size={18} />
              <span className="mt-0.5">{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-20 lg:pb-8">

        {/* Dashboard */}
        {tab === "dashboard" && (
          <div>
            <h1 className="text-white text-2xl font-black mb-6">Übersicht — Heute</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Umsatz", value: `${Number(report?.total || 0).toFixed(2)} €`, icon: TrendingUp, color: "text-green-400" },
                { label: "Bestellungen", value: report?.count || 0, icon: ShoppingBag, color: "text-blue-400" },
                { label: "Bar", value: `${Number(report?.cash || 0).toFixed(2)} €`, icon: Banknote, color: "text-yellow-400" },
                { label: "Karte", value: `${Number(report?.card || 0).toFixed(2)} €`, icon: CreditCard, color: "text-purple-400" },
              ].map(kpi => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-gray-400 text-sm">{kpi.label}</p>
                      <Icon size={18} className={kpi.color} />
                    </div>
                    <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Tische gesamt", value: tables.length },
                { label: "Tische besetzt", value: tables.filter(t => t.status === "occupied").length },
                { label: "Menü-Artikel", value: menuItems.length },
                { label: "Personal", value: staffList.length },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables */}
        {tab === "tables" && (
          <div>
            <h1 className="text-white text-2xl font-black mb-6">Tische verwalten</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <h3 className="text-white font-bold mb-4">Neuer Tisch</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input value={newTable.number} onChange={e => setNewTable(p => ({ ...p, number: e.target.value }))}
                  placeholder="Nummer *" type="number"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input value={newTable.name} onChange={e => setNewTable(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (z.B. Terrasse)"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input value={newTable.capacity} onChange={e => setNewTable(p => ({ ...p, capacity: e.target.value }))}
                  placeholder="Plätze" type="number"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <button onClick={addTable} disabled={saving || !newTable.number}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                <Plus size={16} /> Tisch hinzufügen
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {tables.map(t => (
                <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center">
                  <p className="text-white font-black text-3xl">{t.number}</p>
                  {t.name && <p className="text-gray-400 text-xs mt-1">{t.name}</p>}
                  <p className="text-gray-500 text-xs">{t.capacity} Plätze</p>
                  <button onClick={() => deleteTable(t.id)}
                    className="mt-3 text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors">
                    <Trash2 size={12} /> Löschen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu */}
        {tab === "menu" && (
          <div>
            <h1 className="text-white text-2xl font-black mb-6">Speisekarte</h1>
            {/* Categories */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <h3 className="text-white font-bold mb-4">Kategorien</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-white text-sm">{c.name}</span>
                    <button onClick={() => deleteCategory(c.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                  placeholder="Kategoriename"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input type="color" value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-gray-800 border border-gray-700" />
                <button onClick={addCategory} disabled={!newCat.name || saving}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Add item */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <h3 className="text-white font-bold mb-4">Neuer Artikel</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name *"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                  placeholder="Preis in € *" type="number" step="0.01"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                  placeholder="Beschreibung"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <select value={newItem.category_id} onChange={e => setNewItem(p => ({ ...p, category_id: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="">Keine Kategorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={addMenuItem} disabled={!newItem.name || !newItem.price || saving}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                <Plus size={16} /> Artikel hinzufügen
              </button>
            </div>

            {/* Item list */}
            <div className="space-y-2">
              {categories.map(cat => {
                const items = menuItems.filter(i => i.category_id === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 mt-4">{cat.name}</p>
                    {items.map(item => (
                      <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${item.is_available ? "text-white" : "text-gray-500 line-through"}`}>{item.name}</p>
                          {item.description && <p className="text-gray-500 text-xs">{item.description}</p>}
                        </div>
                        <p className="text-orange-400 font-bold text-sm">{Number(item.price).toFixed(2)} €</p>
                        <button onClick={() => toggleItemAvailable(item)}
                          className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all ${item.is_available ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                          {item.is_available ? "Verfügbar" : "Aus"}
                        </button>
                        <button onClick={() => deleteMenuItem(item.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {menuItems.filter(i => !i.category_id).map(item => (
                <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${item.is_available ? "text-white" : "text-gray-500 line-through"}`}>{item.name}</p>
                  </div>
                  <p className="text-orange-400 font-bold text-sm">{Number(item.price).toFixed(2)} €</p>
                  <button onClick={() => toggleItemAvailable(item)}
                    className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all ${item.is_available ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                    {item.is_available ? "Verfügbar" : "Aus"}
                  </button>
                  <button onClick={() => deleteMenuItem(item.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff */}
        {tab === "staff" && (
          <div>
            <h1 className="text-white text-2xl font-black mb-6">Personal</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <h3 className="text-white font-bold mb-4">Neues Mitglied</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name *"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <input value={newStaff.pin} onChange={e => setNewStaff(p => ({ ...p, pin: e.target.value }))}
                  placeholder="PIN (min. 4 Ziffern) *" type="password"
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                <select value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))}
                  className="col-span-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="kellner">Kellner</option>
                  <option value="kueche">Küche</option>
                  <option value="chef">Chef</option>
                </select>
              </div>
              <button onClick={addStaff} disabled={!newStaff.name || !newStaff.pin || saving}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                <Plus size={16} /> Hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {staffList.map(s => (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 font-bold text-sm">{s.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{s.name}</p>
                    <p className="text-gray-500 text-xs capitalize">{s.role === "kellner" ? "Kellner" : s.role === "kueche" ? "Küche" : "Chef"}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${s.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                    {s.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                  <button onClick={() => deleteStaff(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && settings && (
          <div>
            <h1 className="text-white text-2xl font-black mb-6">Einstellungen</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md">
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Restaurantname</label>
                  <input value={editSettings.restaurant_name}
                    onChange={e => setEditSettings(p => ({ ...p, restaurant_name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Anzahl Tische</label>
                  <input value={editSettings.table_count} type="number"
                    onChange={e => setEditSettings(p => ({ ...p, table_count: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <button onClick={saveSettings} disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                  <Save size={16} /> {saving ? "Wird gespeichert..." : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
