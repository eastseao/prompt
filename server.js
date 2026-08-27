// Prompt 库 — 数据服务（GitHub API 后端）
// 数据文件: prompts.json（存在 eastseao/prompt 仓库 main 分支）
const http = require("http");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3456;
const ROOT = __dirname;
const OWNER = "eastseao";
const REPO = "prompt";
const BRANCH = "main";
const FILE = "prompts.json";
const GH = "C:\\Users\\Administrator\\.local\\bin\\gh.exe";

function gh(args) {
  return new Promise((resolve, reject) => {
    execFile(GH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

// ---- GitHub 内容读写（走 gh CLI，token 不出服务端）----
async function loadPrompts() {
  try {
    const out = await gh([
      "api", `repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
      "--jq", ".content"
    ]);
    const b64 = out.replace(/\s+/g, "");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    if (String(e.message).includes("404")) return { prompts: [] };
    throw e;
  }
}

async function savePrompts(data) {
  // 先取当前 sha（并发安全）
  let sha;
  try {
    const out = await gh([
      "api", `repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
      "--jq", ".sha"
    ]);
    sha = out.trim();
  } catch (e) {
    sha = null; // 文件不存在，新建
  }
  const content = Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64");
  await gh([
    "api", `repos/${OWNER}/${REPO}/contents/${FILE}`,
    "-X", "PUT",
    "-f", `message=${commitPrefix()} ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "-f", `content=${content}`,
    "-f", `branch=${BRANCH}`,
    ...(sha ? ["-f", `sha=${sha}`] : []),
  ]);
}

function commitPrefix() {
  const h = new Date().getHours();
  if (h < 6) return "🌙 夜间更新";
  if (h < 12) return "🌅 早间更新";
  if (h < 18) return "☀️ 午间更新";
  return "🌆 晚间更新";
}

// ---- 简易路由 ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API
  if (url.pathname === "/api/prompts" && req.method === "GET") {
    try {
      const data = await loadPrompts();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    } catch (e) { api500(res, e); }
    return;
  }

  if (url.pathname === "/api/prompts" && req.method === "POST") {
    try {
      const p = await readBody(req);
      if (!p.title || !p.content) return badRequest(res, "title 和 content 必填");
      const data = await loadPrompts();
      const now = Date.now();
      const item = {
        id: now.toString(36) + Math.random().toString(36).slice(2, 6),
        title: String(p.title).slice(0, 200),
        content: String(p.content),
        category: p.category ? String(p.category).slice(0, 50) : "",
        tags: Array.isArray(p.tags) ? p.tags.map(t => String(t).slice(0, 30)) : [],
        favorite: !!p.favorite,
        createdAt: now,
        updatedAt: now,
      };
      data.prompts.unshift(item);
      await savePrompts(data);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, item }));
    } catch (e) { api500(res, e); }
    return;
  }

  if (url.pathname.startsWith("/api/prompts/") && req.method === "PUT") {
    try {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const p = await readBody(req);
      const data = await loadPrompts();
      const item = data.prompts.find(x => x.id === id);
      if (!item) return notFound(res);
      if (p.title !== undefined) item.title = String(p.title).slice(0, 200);
      if (p.content !== undefined) item.content = String(p.content);
      if (p.category !== undefined) item.category = String(p.category).slice(0, 50);
      if (p.tags !== undefined) item.tags = Array.isArray(p.tags) ? p.tags.map(t => String(t).slice(0, 30)) : [];
      if (p.favorite !== undefined) item.favorite = !!p.favorite;
      item.updatedAt = Date.now();
      await savePrompts(data);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, item }));
    } catch (e) { api500(res, e); }
    return;
  }

  if (url.pathname.startsWith("/api/prompts/") && req.method === "DELETE") {
    try {
      const id = decodeURIComponent(url.pathname.split("/")[3]);
      const data = await loadPrompts();
      const idx = data.prompts.findIndex(x => x.id === id);
      if (idx === -1) return notFound(res);
      data.prompts.splice(idx, 1);
      await savePrompts(data);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) { api500(res, e); }
    return;
  }

  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    return;
  }

  // 静态文件
  serveStatic(req, res, url.pathname);
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function badRequest(res, msg) {
  res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: msg }));
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not found" }));
}

function api500(res, e) {
  console.error(`[api] ${e.message}`);
  res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: e.message }));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  const file = path.normalize(path.join(ROOT, "public", pathname));
  if (!file.startsWith(path.join(ROOT, "public"))) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not Found"); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`Prompt 库已启动: http://localhost:${PORT}`);
  console.log(`数据后端: github.com/${OWNER}/${REPO} (${FILE} @ ${BRANCH})`);
});
