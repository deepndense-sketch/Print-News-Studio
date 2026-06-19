const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const packageInfo = require("./package.json");

const PORT = Number(process.env.PORT || 4862);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const LOGO_DIR = path.join(DATA_DIR, "logos");
const FONT_DIR = path.join(DATA_DIR, "fonts");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const APP_VERSION = packageInfo.version || "0.0.0";
const UPDATE_INFO_URL = "https://raw.githubusercontent.com/deepndense-sketch/Print-News-Studio/main/update.json";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".zip": "application/zip"
};

function ensureFolders() {
  for (const dir of [DATA_DIR, LOGO_DIR, FONT_DIR, EXPORT_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body, null, 2));
}

function cleanName(value) {
  return String(value || "unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "unknown";
}

function cleanLogoName(value) {
  return String(value || "Unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Unknown";
}

function missingLogoNoteName(name) {
  const cleaned = String(name || "Unknown").trim();
  const parts = cleaned ? cleaned.split(".") : [];
  return parts.length > 1 ? parts.slice(0, -1).join(".") : cleaned;
}

function preferredLogoName(name) {
  const preferred = missingLogoNoteName(String(name || "Unknown").trim());
  return cleanLogoName(preferred || name);
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  const root = path.resolve(base);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function cleanFolderInput(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function expandFolderInput(value) {
  let input = cleanFolderInput(value);
  input = input.replace(/%([^%]+)%/g, (match, name) => process.env[name] || process.env[name.toUpperCase()] || match);
  if (/^~(?=$|[\\/])/.test(input)) {
    input = path.join(process.env.USERPROFILE || process.env.HOME || ROOT, input.slice(1));
  }
  return input;
}

function resolveExportFolder(value) {
  const input = expandFolderInput(value);
  return input ? path.resolve(ROOT, input) : EXPORT_DIR;
}

function resolveFontFolder(value) {
  const input = expandFolderInput(value);
  return input ? path.resolve(ROOT, input) : FONT_DIR;
}

function readSettingsRaw() {
  ensureFolders();
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function settingsResponse(raw = readSettingsRaw()) {
  const exportFolderInput = typeof raw.exportFolder === "string" ? cleanFolderInput(raw.exportFolder) : "";
  const fontFolderInput = typeof raw.fontFolder === "string" ? cleanFolderInput(raw.fontFolder) : "";
  return {
    exportFolder: resolveExportFolder(exportFolderInput),
    exportFolderInput,
    defaultExportFolder: EXPORT_DIR,
    fontFolder: resolveFontFolder(fontFolderInput),
    fontFolderInput,
    defaultFontFolder: FONT_DIR
  };
}

function saveSettings(payload) {
  ensureFolders();
  const existing = readSettingsRaw();
  const hasExportFolder = Object.prototype.hasOwnProperty.call(payload, "exportFolder");
  const hasFontFolder = Object.prototype.hasOwnProperty.call(payload, "fontFolder");
  const exportFolderInput = cleanFolderInput(hasExportFolder ? payload.exportFolder : existing.exportFolder);
  const fontFolderInput = cleanFolderInput(hasFontFolder ? payload.fontFolder : existing.fontFolder);
  const exportFolder = resolveExportFolder(exportFolderInput);
  const fontFolder = resolveFontFolder(fontFolderInput);
  fs.mkdirSync(exportFolder, { recursive: true });
  fs.mkdirSync(fontFolder, { recursive: true });
  const storedExportInput = path.resolve(exportFolder) === path.resolve(EXPORT_DIR) ? "" : exportFolderInput;
  const storedFontInput = path.resolve(fontFolder) === path.resolve(FONT_DIR) ? "" : fontFolderInput;
  const settings = {
    exportFolder: storedExportInput,
    fontFolder: storedFontInput
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
  return settingsResponse(settings);
}

function currentExportFolder() {
  const settings = settingsResponse();
  fs.mkdirSync(settings.exportFolder, { recursive: true });
  return settings.exportFolder;
}

function currentFontFolder() {
  const settings = settingsResponse();
  fs.mkdirSync(settings.fontFolder, { recursive: true });
  return settings.fontFolder;
}

function exportUrlFor(filePath) {
  const relative = path.relative(EXPORT_DIR, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return `/exports/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function openFolderInExplorer(folder) {
  return new Promise((resolve, reject) => {
    execFile("explorer.exe", [folder], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function chooseFolderInWindows(startFolder) {
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Choose headline font folder'",
    "$dialog.ShowNewFolderButton = $true",
    "$start = $env:PRINT_NEWS_START_FOLDER",
    "if ($start -and (Test-Path -LiteralPath $start)) { $dialog.SelectedPath = $start }",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ].join("; ");

  return new Promise((resolve, reject) => {
    execFile("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      env: { ...process.env, PRINT_NEWS_START_FOLDER: startFolder || "" },
      windowsHide: false
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(cleanFolderInput(stdout));
    });
  });
}

function compareVersions(a, b) {
  const left = String(a || "0").replace(/^v/i, "").split(".").map((part) => Number(part) || 0);
  const right = String(b || "0").replace(/^v/i, "").split(".").map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": `PrintNewsStudio/${APP_VERSION}`
      }
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirects < 3) {
        res.resume();
        resolve(fetchJson(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }

      if (status !== 200) {
        res.resume();
        reject(new Error(`Update check failed (${status}).`));
        return;
      }

      let size = 0;
      const chunks = [];
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          req.destroy(new Error("Update response is too large."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new Error("Update response is not valid JSON."));
        }
      });
    });
    req.setTimeout(7000, () => req.destroy(new Error("Update check timed out.")));
    req.on("error", reject);
  });
}

async function checkForUpdate() {
  try {
    const info = await fetchJson(UPDATE_INFO_URL);
    const latestVersion = String(info.version || "").replace(/^v/i, "") || APP_VERSION;
    return {
      currentVersion: APP_VERSION,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0,
      downloadUrl: String(info.downloadUrl || ""),
      pageUrl: String(info.pageUrl || ""),
      notes: String(info.notes || "")
    };
  } catch (error) {
    return {
      currentVersion: APP_VERSION,
      latestVersion: "",
      updateAvailable: false,
      downloadUrl: "",
      pageUrl: "",
      notes: "",
      error: error.message || "Could not check updates."
    };
  }
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = mime.includes("png") ? ".png"
    : mime.includes("webp") ? ".webp"
      : mime.includes("svg") ? ".svg"
        : ".jpg";
  return { ext, buffer: Buffer.from(match[2], "base64") };
}

function parsePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function cleanFileName(value) {
  const name = String(value || "news.png")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 170) || "news.png";
  return /\.png$/i.test(name) ? name : `${name}.png`;
}

function uniquePath(dir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(dir, fileName);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function uniqueZipName(fileName, used) {
  const parsed = path.parse(cleanFileName(fileName));
  let name = `${parsed.name}${parsed.ext}`;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    name = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const data = file.buffer;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function listLogos() {
  ensureFolders();
  return fs.readdirSync(LOGO_DIR)
    .filter((file) => /\.(png|jpe?g|jfif|webp|svg|gif|bmp|ico|tiff?)$/i.test(file))
    .map((file) => {
      const parsed = path.parse(file);
      const stat = fs.statSync(path.join(LOGO_DIR, file));
      return {
        key: parsed.name,
        file,
        url: `/logos/${encodeURIComponent(file)}`,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function listFonts() {
  ensureFolders();
  const fontFolder = currentFontFolder();
  return fs.readdirSync(fontFolder)
    .filter((file) => /\.(ttf|otf|woff2?)$/i.test(file))
    .map((file) => {
      const parsed = path.parse(file);
      const stat = fs.statSync(path.join(fontFolder, file));
      const family = `PrintNewsStudioFont_${crypto.createHash("sha1").update(file).digest("hex").slice(0, 12)}`;
      return {
        key: parsed.name,
        file,
        family,
        url: `/fonts/${encodeURIComponent(file)}`,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function exportDocument(payload) {
  ensureFolders();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = cleanName(payload.title || "news-export") + "-" + stamp;
  const jsonPath = path.join(EXPORT_DIR, `${base}.json`);
  const htmlPath = path.join(EXPORT_DIR, `${base}.html`);
  const summary = {
    title: payload.title || "News Export",
    exportedAt: new Date().toISOString(),
    items: Array.isArray(payload.items) ? payload.items : []
  };
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  fs.writeFileSync(htmlPath, String(payload.html || ""), "utf8");
  return {
    json: `/exports/${encodeURIComponent(path.basename(jsonPath))}`,
    html: `/exports/${encodeURIComponent(path.basename(htmlPath))}`,
    savedFiles: {
      json: jsonPath,
      html: htmlPath
    }
  };
}

function exportPngImages(payload) {
  ensureFolders();
  const exportFolder = currentExportFolder();
  const images = Array.isArray(payload.images) ? payload.images : [];
  const files = [];

  for (const image of images) {
    const buffer = parsePngDataUrl(image.dataUrl);
    if (!buffer) continue;

    const fileName = cleanFileName(image.filename);
    const target = uniquePath(exportFolder, fileName);
    fs.writeFileSync(target, buffer);
    files.push({
      name: path.basename(target),
      url: exportUrlFor(target),
      savedFile: target
    });
  }

  return {
    count: files.length,
    files,
    exportFolder
  };
}

function exportPngZip(payload) {
  ensureFolders();
  const exportFolder = currentExportFolder();
  const images = Array.isArray(payload.images) ? payload.images : [];
  const used = new Set();
  const files = [];

  for (const image of images) {
    const buffer = parsePngDataUrl(image.dataUrl);
    if (!buffer) continue;
    files.push({
      name: uniqueZipName(image.filename, used),
      buffer
    });
  }

  if (!files.length) {
    return { count: 0, name: "", url: "", savedFile: "", exportFolder };
  }

  const random = crypto.randomInt(100000, 1000000);
  const fileName = `Priority News_${random}.zip`;
  const target = uniquePath(exportFolder, fileName);
  fs.writeFileSync(target, createZip(files));
  return {
    count: files.length,
    name: path.basename(target),
    url: exportUrlFor(target),
    savedFile: target,
    exportFolder
  };
}

function saveMissingLogos(payload) {
  ensureFolders();
  const missing = Array.isArray(payload.missing) ? payload.missing : [];
  const names = [...new Set(missing.map((entry) => String(entry.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filePath = path.join(DATA_DIR, "missing_logos.txt");
  fs.writeFileSync(filePath, names.join("\n") + (names.length ? "\n" : ""), "utf8");
  return {
    count: names.length,
    file: filePath,
    url: "/missing_logos.txt"
  };
}

async function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/version") {
    sendJson(res, 200, { version: APP_VERSION });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/update-check") {
    sendJson(res, 200, await checkForUpdate());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    sendJson(res, 200, settingsResponse());
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = JSON.parse(await readBody(req));
    sendJson(res, 200, saveSettings(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/open-export-folder") {
    const exportFolder = currentExportFolder();
    await openFolderInExplorer(exportFolder);
    sendJson(res, 200, { exportFolder });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/fonts") {
    const settings = settingsResponse();
    sendJson(res, 200, {
      fonts: listFonts(),
      fontFolder: settings.fontFolder,
      fontFolderInput: settings.fontFolderInput,
      defaultFontFolder: settings.defaultFontFolder
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/open-font-folder") {
    const fontFolder = currentFontFolder();
    await openFolderInExplorer(fontFolder);
    sendJson(res, 200, { fontFolder });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/choose-font-folder") {
    const body = JSON.parse(await readBody(req));
    const requestedFolder = resolveFontFolder(body.fontFolder);
    const chosenFolder = await chooseFolderInWindows(requestedFolder);
    if (!chosenFolder) {
      sendJson(res, 200, { ...settingsResponse(), canceled: true });
      return true;
    }
    sendJson(res, 200, saveSettings({ fontFolder: chosenFolder }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/logos") {
    sendJson(res, 200, { logos: listLogos() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logo") {
    const body = JSON.parse(await readBody(req));
    const source = String(body.source || "").trim();
    const parsed = parseDataUrl(body.dataUrl);
    if (!source) {
      sendJson(res, 400, { error: "Source name is required before saving a logo." });
      return true;
    }
    if (!parsed) {
      sendJson(res, 400, { error: "Paste an image logo first." });
      return true;
    }

    const key = preferredLogoName(source);
    for (const old of fs.readdirSync(LOGO_DIR).filter((file) => path.parse(file).name.toLowerCase() === key.toLowerCase())) {
      fs.unlinkSync(path.join(LOGO_DIR, old));
    }
    const file = `${key}${parsed.ext}`;
    const target = path.join(LOGO_DIR, file);
    fs.writeFileSync(target, parsed.buffer);
    sendJson(res, 200, {
      key,
      file,
      url: `/logos/${encodeURIComponent(file)}?t=${Date.now()}`
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/export") {
    const body = JSON.parse(await readBody(req));
    sendJson(res, 200, exportDocument(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/png-export") {
    const body = JSON.parse(await readBody(req, 80 * 1024 * 1024));
    sendJson(res, 200, exportPngImages(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/png-zip") {
    const body = JSON.parse(await readBody(req, 80 * 1024 * 1024));
    sendJson(res, 200, exportPngZip(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/missing-logos") {
    const body = JSON.parse(await readBody(req));
    sendJson(res, 200, saveMissingLogos(body));
    return true;
  }

  return false;
}

function serveFile(res, base, requestPath) {
  const filePath = safeJoin(base, requestPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function createServer() {
  ensureFolders();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) {
        if (await routeApi(req, res, url)) return;
      }

      if (url.pathname.startsWith("/logos/")) {
        serveFile(res, LOGO_DIR, decodeURIComponent(url.pathname.replace("/logos/", "")));
        return;
      }

      if (url.pathname.startsWith("/fonts/")) {
        serveFile(res, currentFontFolder(), decodeURIComponent(url.pathname.replace("/fonts/", "")));
        return;
      }

      if (url.pathname.startsWith("/exports/")) {
        serveFile(res, EXPORT_DIR, decodeURIComponent(url.pathname.replace("/exports/", "")));
        return;
      }

      if (url.pathname === "/missing_logos.txt") {
        serveFile(res, DATA_DIR, "missing_logos.txt");
        return;
      }

      const requestPath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      serveFile(res, PUBLIC_DIR, requestPath);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Something went wrong." });
    }
  });
}

createServer().listen(PORT, () => {
  console.log(`Print News Studio running at http://localhost:${PORT}`);
  console.log(`Logos: ${LOGO_DIR}`);
  console.log(`Exports: ${EXPORT_DIR}`);
});
