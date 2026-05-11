/**
 * Production-Mode HTTPS Server fuer Next.js (Layer 1).
 *
 * Verwendung:
 *   npm run build && npm run start:https
 *
 * Liest cert/key aus certs/ Ordner oder ENV (TLS_CERT_FILE, TLS_KEY_FILE).
 *
 * HINWEIS: In echter Produktion stattdessen einen Reverse-Proxy (Caddy/nginx)
 * mit Let's-Encrypt vor `next start` schalten.
 */
import { createServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import next from "next";

const dev = false;
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const CERT_PATH = process.env.TLS_CERT_FILE || resolve("./certs/localhost.pem");
const KEY_PATH = process.env.TLS_KEY_FILE || resolve("./certs/localhost-key.pem");

if (!existsSync(CERT_PATH) || !existsSync(KEY_PATH)) {
  console.error(
    `TLS-Cert nicht gefunden:\n  cert: ${CERT_PATH}\n  key:  ${KEY_PATH}\n` +
      `Erstellen mit:  mkcert -install && cd certs && mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1`
  );
  process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpsOptions = {
  cert: readFileSync(CERT_PATH),
  key: readFileSync(KEY_PATH),
  minVersion: "TLSv1.2",
};

createServer(httpsOptions, (req, res) => {
  handle(req, res);
}).listen(port, () => {
  console.log(`> Ready on https://${hostname}:${port}`);
});
