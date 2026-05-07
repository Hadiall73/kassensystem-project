"use client";
import { useEffect, useState } from "react";

export default function ValidPage() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center select-none"
      style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)" }}
    >
      {/* Pulsierender Ring */}
      <div className="relative flex items-center justify-center mb-8">
        <div
          className="absolute w-56 h-56 rounded-full bg-white/10"
          style={{ animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }}
        />
        <div className="absolute w-44 h-44 rounded-full bg-white/15" />
        <div className="w-36 h-36 rounded-full bg-white/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,0.4))" }}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
      </div>

      <h1
        className="text-white font-black text-6xl tracking-tight mb-2"
        style={{ textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
      >
        GÜLTIG
      </h1>
      <p className="text-green-100 text-xl font-medium mb-1">✓ Zugang gewährt</p>
      <p className="text-green-200/70 text-sm font-mono mt-2">{time}</p>

      <div className="fixed bottom-0 left-0 right-0 h-3 bg-white/20" />

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
