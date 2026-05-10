/**
 * Client-side API-Helper (Layer 5).
 *
 * Liest Auth-Token aus sessionStorage und fuegt ihn als
 * "Authorization: Bearer ..." zu jedem fetch hinzu.
 *
 * Verwendung statt direkt fetch():
 *   const res = await api("/api/orders", { method: "POST", body: JSON.stringify(...) });
 *
 * Bei 401: leitet automatisch zu /login um.
 */

const TOKEN_KEY = "pos_staff_token";
const STAFF_KEY = "pos_staff";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(staff: unknown, token: string) {
  sessionStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  sessionStorage.removeItem(STAFF_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function api(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    // Token abgelaufen oder ungueltig → ausloggen
    clearSession();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  return res;
}
