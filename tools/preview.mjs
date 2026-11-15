// Loopback-only preview. Uses an in-memory database and a test verification stub.
// This file is never uploaded to Cloudflare. Production has no test bypass.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../backend/worker.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const db = new DatabaseSync(':memory:');
db.exec(await readFile(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
const handler = createHandler(async () => Response.json({ success: true, hostname: 'vernia.in', action: 'waitlist' }));
const env = { DB: { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) || null; } }; } }; } }, TURNSTILE_SECRET: 'local-test-only', SIGNUP_LIMITER: { limit: async () => ({ success: true }) } };
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.xml': 'application/xml' };
const publicFiles = new Set(['index.html','hardware.html','waitlist.html','privacy.html','404.html','styles.css','home.css','hardware.css','production.css','app.js','waitlist.js','site-config.js','favicon.svg','robots.txt','sitemap.xml']);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    if (url.pathname === '/site-config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(`export const siteConfig={waitlistEndpoint:'/api/waitlist',turnstileSiteKey:'1x00000000000000000000AA'};`); return; }
    if (url.pathname === '/api/waitlist' && req.method === 'POST') {
      const chunks=[]; let size=0; for await (const c of req) { size+=c.length; if(size>8192){res.writeHead(413);res.end();return;}chunks.push(c); }
      const response = await handler(new Request('https://local-preview.example/waitlist', { method: 'POST', headers: { origin: 'https://vernia.in', 'content-type':'application/json', 'CF-Connecting-IP':'192.0.2.1' }, body: Buffer.concat(chunks) }),env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    const relative = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
    const full = resolve(root, relative);
    if (!full.startsWith(resolve(root)+sep) || (!publicFiles.has(relative) && !relative.startsWith('assets/'))) {res.writeHead(404);res.end('Not found');return;}
    let bytes = await readFile(full);
    if (extname(full)==='.html') bytes=Buffer.from(bytes.toString().replace(/<script[^>]+cloudflareinsights[^>]*><\/script>/g,''));
    res.writeHead(200,{ 'Content-Type':mime[extname(full)]||'application/octet-stream', 'Cache-Control':'no-store' });res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local test preview: http://127.0.0.1:4173/waitlist.html (in-memory test signups only)'));
