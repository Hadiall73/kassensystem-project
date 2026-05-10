"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (pin.length < 4) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", pin }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError("Falscher PIN"); setPin(""); return; }
    const staff = json.staff;
    sessionStorage.setItem("pos_staff", JSON.stringify(staff));
    if (json.token) sessionStorage.setItem("pos_staff_token", json.token);
    if (staff.role === "chef") router.replace("/chef");
    else if (staff.role === "kueche") router.replace("/kueche");
    else router.replace("/kasse");
  }

  function press(val: string) {
    if (pin.length >= 6) return;
    const next = pin + val;
    setPin(next);
    if (next.length >= 4) setTimeout(() => handleLoginWith(next), 100);
  }

  async function handleLoginWith(p: string) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", pin: p }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError("Falscher PIN"); setPin(""); return; }
    const staff = json.staff;
    sessionStorage.setItem("pos_staff", JSON.stringify(staff));
    if (json.token) sessionStorage.setItem("pos_staff_token", json.token);
    if (staff.role === "chef") router.replace("/chef");
    else if (staff.role === "kueche") router.replace("/kueche");
    else router.replace("/kasse");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-white text-2xl font-black">Kassensystem</h1>
          <p className="text-gray-500 text-sm mt-1">PIN eingeben</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? "bg-orange-500 border-orange-500" : "border-gray-600"}`} />
          ))}
        </div>

        {error && <p className="text-red-400 text-center text-sm mb-4">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map(n => (
            <button key={n} onClick={() => press(n)} disabled={loading}
              className="h-16 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white text-2xl font-bold transition-all active:scale-95">
              {n}
            </button>
          ))}
          <button onClick={() => setPin("")} disabled={loading}
            className="h-16 rounded-2xl bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-sm font-semibold transition-all">
            C
          </button>
          <button onClick={() => press("0")} disabled={loading}
            className="h-16 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white text-2xl font-bold transition-all active:scale-95">
            0
          </button>
          <button onClick={() => setPin(p => p.slice(0, -1))} disabled={loading}
            className="h-16 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-400 transition-all flex items-center justify-center">
            <Delete size={20} />
          </button>
        </div>

        {loading && <p className="text-center text-orange-400 text-sm mt-4 animate-pulse">Wird geprüft...</p>}
      </div>
    </div>
  );
}
