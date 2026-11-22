// Local preview for The Introduction.
//
// Fictional room, when no private folder is present:
//   node scripts/preview-server.js
//
// Real room, from CSVs that are not in git:
//   MEMBERS_CSV_DIR=/absolute/path/to/csvs node scripts/preview-server.js
//
// The folder is read in the server process. It is not written back,
// not served as files, and not sent to the browser.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleIntroduction } = require("../lib/introduction/engine");

const root = path.join(__dirname, "..");
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".json": "application/json; charset=utf-8"
};

function blocked(urlPath) {
  return urlPath === "/data"
    || urlPath.startsWith("/data/")
    || urlPath === "/lib"
    || urlPath.startsWith("/lib/")
    || urlPath === "/scripts"
    || urlPath.startsWith("/scripts/")
    || urlPath.startsWith("/.git")
    || urlPath.toLowerCase().endsWith(".csv");
}

function send(res, status, body, type) {
  res.statusCode = status;
  if (type) res.setHeader("content-type", type);
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/api/introduction") {
    const result = await handleIntroduction(req);
    res.statusCode = result.status;
    Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    res.end(JSON.stringify(result.body));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Quiet");
    return;
  }
  if (blocked(url.pathname)) {
    send(res, 404, "Not found");
    return;
  }
  const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  let filePath = path.resolve(root, requested);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    send(res, 404, "Not found");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("content-type", types[ext] || "application/octet-stream");
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Introduction preview at http://127.0.0.1:${port}/introduction\n`);
});
