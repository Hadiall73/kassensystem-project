/** @type {import('next').NextConfig} */

/**
 * Security Headers (Layer 1: Network/HTTP Firewall)
 *
 * Schützt vor:
 * - XSS / Code-Injection (CSP)
 * - Clickjacking (X-Frame-Options + frame-ancestors)
 * - MIME-Sniffing (X-Content-Type-Options)
 * - MITM / Downgrade (HSTS)
 * - Referrer-Leaks (Referrer-Policy)
 * - Browser-Feature-Missbrauch (Permissions-Policy)
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js braucht inline für Hydration
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=(self)",
    ].join(", "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig = {
  poweredByHeader: false, // versteckt "X-Powered-By: Next.js"
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
