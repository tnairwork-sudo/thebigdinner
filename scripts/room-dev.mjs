/**
 * Local Room server: static site plus /api/room/*.
 * Production never uses this file; Vercel runs api/room directly.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (!process.env.ROOM_DATA_DIR) process.env.ROOM_DATA_DIR = path.join(root, '.data', 'room');

const { default: check } = await import('../api/room/check.js');
const { default: register } = await import('../api/room/register.js');
const { default: login } = await import('../api/room/login.js');
const { default: logout } = await import('../api/room/logout.js');
const { default: session } = await import('../api/room/session.js');
const { default: profile } = await import('../api/room/profile.js');

const routes = {
  '/api/room/check': check,
  '/api/room/register': register,
  '/api/room/login': login,
  '/api/room/logout': logout,
  '/api/room/session': session,
  '/api/room/profile': profile,
};

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

function blocked(file) {
  const rel = path.relative(root, file);
  return rel === 'lib' || rel.startsWith(`lib${path.sep}`) || rel === '.data' || rel.startsWith(`.data${path.sep}`) || rel.split(path.sep).includes('node_modules');
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root) || blocked(file)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(data);
  });
}

const port = Number(process.env.PORT || 4173);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const handler = routes[url.pathname];
  if (handler) {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(err && err.name);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('error');
      }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Room dev http://127.0.0.1:${port}/c27b141aa0bbb112ebe5405b/`);
});
