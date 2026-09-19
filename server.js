const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'chat-data.json');

let db = { users: [], friends: {}, chats: {}, messages: {} };
try { const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); db = Object.assign(db, raw); } catch (e) {}

let saveTimer = null;
function saveDB() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFile(DB_FILE, JSON.stringify(db), () => {}), 300); }

function mergeInto(target, src) {
  if (!src) return;
  const um = new Map(); (target.users || []).forEach(u => um.set(u.id, u)); (src.users || []).forEach(u => um.set(u.id, u)); target.users = [...um.values()];
  const friends = {}; const fkeys = new Set([...Object.keys(target.friends || {}), ...Object.keys(src.friends || {})]); fkeys.forEach(k => { friends[k] = [...new Set([...(target.friends?.[k] || []), ...(src.friends?.[k] || [])])]; }); target.friends = friends;
  const cm = new Map(Object.entries(target.chats || {})); Object.entries(src.chats || {}).forEach(([id, c]) => { const existing = cm.get(id); if (existing && existing.deleted && !c.deleted) return; cm.set(id, c); }); target.chats = Object.fromEntries(cm);
  const messages = {}; const mkeys = new Set([...Object.keys(target.messages || {}), ...Object.keys(src.messages || {})]); mkeys.forEach(k => { const mm = new Map(); (target.messages?.[k] || []).forEach(m => mm.set(m.id, m)); (src.messages?.[k] || []).forEach(m => mm.set(m.id, m)); messages[k] = [...mm.values()].sort((a, b) => a.ts - b.ts); }); target.messages = messages;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  if (p === '/api/db' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(db)); }
  if (p === '/api/sync' && req.method === 'POST') {
    let body = ''; req.on('data', c => { body += c; if (body.length > 30 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { mergeInto(db, JSON.parse(body)); saveDB(); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(db)); } catch (e) { res.writeHead(400); res.end('{"error":"bad json"}'); } });
    return;
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p)); if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); res.end(data); });
});

server.listen(PORT, '0.0.0.0', () => { console.log('\n  ✅ Liquid Chat 已启动\n'); console.log(`  本机访问:  http://localhost:${PORT}`); console.log('\n  按 Ctrl+C 停止\n'); });
