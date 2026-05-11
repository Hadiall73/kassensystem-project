# Security Policy — kassensystem

## Defense-in-Depth Architektur

| Schicht | Modul / Datei | Was es schuetzt |
|---|---|---|
| **1. Network/HTTP** | `next.config.mjs` (CSP, HSTS, X-Frame-Options, Permissions-Policy) | XSS, Clickjacking, MITM |
| **2. Rate-Limit** | `middleware.ts` + `lib/rate-limit.ts` (Edge Token-Bucket) | Brute-Force, DDoS |
| **3. Input-Validation** | `lib/validate.ts` + `lib/schemas.ts` (zod) | SQL-Injection, XSS, Mass-Assignment |
| **4. Auth** | `lib/auth-server.ts` (JWT, AUTH_SECRET enforcement) + `lib/api-client.ts` | Token-Diebstahl, Anonymous-Writes |
| **5. Authorization** | `requireAuth()` + `checkRole()` in jeder API-Route | Privilege Escalation |
| **6. Audit-Logging** | `lib/audit-log.ts` + `sql/audit-log.sql` (Supabase) | Forensik, Intrusion Detection |
| **7. Dependency-Firewall** | `.github/dependabot.yml` + `.github/workflows/security.yml` | Supply-Chain-Angriffe |

## Wie melde ich eine Sicherheitsluecke?

Bitte **nicht** als oeffentliches GitHub-Issue, sondern direkt per E-Mail an alzoubihadii@gmail.com.

## Mindest-Setup vor Produktion

- [ ] `.env.local` mit folgenden Variablen:
  ```
  AUTH_SECRET=<32+ zufaellige Zeichen>
  NEXT_PUBLIC_SUPABASE_URL=https://...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...
  ```
  Secret generieren:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  ```
- [ ] `sql/audit-log.sql` in Supabase SQL Editor ausfuehren
- [ ] Supabase RLS-Policies fuer `pos_*` Tabellen aktivieren
- [ ] Frontend nur ueber HTTPS hosten (Vercel/Cloudflare Pages = automatisch)
- [ ] Supabase Service-Role-Key NIE im Client einbinden (nur in `lib/supabase.ts` als `supabaseAdmin`)

## Bekannte offene Sicherheits-Punkte

### High Priority
- **Next.js Major-Upgrade noetig**: Aktuell auf Next.js 14.2.x mit bekannten DoS-Luecken
  (HTTP request smuggling, Image Optimizer DoS, etc.). Fix erfordert Upgrade auf 16.2.6+,
  was ein Major-Upgrade mit Breaking-Changes ist.
  → siehe https://github.com/advisories/GHSA-... (laeuft via Dependabot)

### Medium Priority
- **In-Memory Rate-Limiter**: `lib/rate-limit.ts` nutzt eine Map.
  Bei Vercel-Deployments (jeder Cold-Start = leere Map) → Upstash/Redis-Adapter empfohlen.
- **AUTH_SECRET in `.env.local`**: Vor Produktion in den Hosting-Provider-Secret-Store
  uebertragen (Vercel Environment Variables, etc.), nicht in Git.
- **PIN als Klartext in Supabase**: `pos_staff.pin` ist aktuell Klartext.
  → Migration zu bcrypt-Hash empfohlen (oder ganz auf Supabase Auth umstellen).
- **API-Routen umgehen RLS**: `supabaseAdmin` (service role) wird in allen API-Routen
  verwendet. Defense-in-depth: zusaetzlich Row-Level-Security Policies aktivieren.

### Audit-Log
- Logs >= severity `info` nach 90 Tagen archivieren/loeschen
- Logs >= severity `security` mind. 1 Jahr aufheben (DSGVO + Forensik)
