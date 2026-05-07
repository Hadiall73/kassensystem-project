"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const staff = sessionStorage.getItem("pos_staff");
    if (staff) {
      const s = JSON.parse(staff);
      if (s.role === "chef") router.replace("/chef");
      else if (s.role === "kueche") router.replace("/kueche");
      else router.replace("/kasse");
    } else {
      router.replace("/login");
    }
  }, []);
  return <div className="min-h-screen bg-gray-950" />;
}
