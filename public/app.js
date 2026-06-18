const state = {
  items: [],
  logos: new Map(),
  settings: {
    exportFolder: "",
    exportFolderInput: "",
    defaultExportFolder: ""
  }
};

const els = {
  excelPaste: document.querySelector("#excelPaste"),
  parseBtn: document.querySelector("#parseBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  parseStatus: document.querySelector("#parseStatus"),
  itemsEmpty: document.querySelector("#itemsEmpty"),
  itemsList: document.querySelector("#itemsList"),
  previewList: document.querySelector("#previewList"),
  itemTemplate: document.querySelector("#itemTemplate"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  loadDraftBtn: document.querySelector("#loadDraftBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  roundCorners: document.querySelector("#roundCorners"),
  exportFolderInput: document.querySelector("#exportFolderInput"),
  saveExportFolderBtn: document.querySelector("#saveExportFolderBtn"),
  openExportFolderBtn: document.querySelector("#openExportFolderBtn"),
  newsColorMode: document.querySelector("#newsColorMode"),
  saveExportBtn: document.querySelector("#saveExportBtn"),
  pngExportBtn: document.querySelector("#pngExportBtn"),
  zipExportBtn: document.querySelector("#zipExportBtn"),
  exportStatus: document.querySelector("#exportStatus")
};

const DRAFT_KEY = "print-news-studio-draft-v2";
const HEADER_WORDS = new Set(["date", "number", "no", "news", "title", "headline", "link", "url"]);
const NEWS_COLOR_VALUES = {
  white: "#ffffff",
  grey: "#f8f9fb",
  cream: "#fff6e5"
};
const RANDOM_COLOR_KEYS = ["white", "grey", "cream"];

function newsColorMode() {
  return els.newsColorMode?.value || "white";
}

function assignRandomNewsColors() {
  let shuffled = [];
  state.items.forEach((item, index) => {
    if (index % RANDOM_COLOR_KEYS.length === 0) {
      shuffled = [...RANDOM_COLOR_KEYS].sort(() => Math.random() - 0.5);
    }
    item.newsColor = shuffled[index % RANDOM_COLOR_KEYS.length];
  });
}

function newsColorKey(item, index) {
  const mode = newsColorMode();
  if (mode === "random") {
    if (!item.newsColor) {
      item.newsColor = RANDOM_COLOR_KEYS[index % RANDOM_COLOR_KEYS.length];
    }
    return item.newsColor;
  }
  if (mode === "white-cream") {
    return index % 2 === 0 ? "white" : "cream";
  }
  if (mode === "white-grey") {
    return index % 2 === 0 ? "white" : "grey";
  }
  return mode;
}

function newsBackground(item, index) {
  return NEWS_COLOR_VALUES[newsColorKey(item, index)] || NEWS_COLOR_VALUES.white;
}

function slug(value) {
  return String(value || "unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const output = document.createElement("div");

  function cleanNode(node, inheritedBold = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed"].includes(tag)) {
      return document.createDocumentFragment();
    }

    if (tag === "br") {
      return document.createTextNode(" ");
    }

    const styleWeight = String(node.style?.fontWeight || node.getAttribute("style") || "").toLowerCase();
    const isBold = inheritedBold
      || tag === "b"
      || tag === "strong"
      || /font-weight\s*:\s*(bold|[6-9]00)/i.test(styleWeight)
      || /^(bold|[6-9]00)$/i.test(styleWeight.trim());
    const wrapper = isBold ? document.createElement("strong") : document.createDocumentFragment();

    node.childNodes.forEach((child) => {
      wrapper.appendChild(cleanNode(child, isBold));
    });
    return wrapper;
  }

  template.content.childNodes.forEach((node) => {
    output.appendChild(cleanNode(node));
  });

  return output.innerHTML.replace(/\s+/g, " ").trim();
}

function plainTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  return normalizeWhitespace(template.content.textContent || "");
}

function titleHtml(item) {
  const html = item.titleHtml || escapeHtml(item.title || "");
  return sanitizeRichHtml(html);
}

function renderTitleHtml(item) {
  return titleHtml(item).replace(/\s*\/\/\s*/g, "<br>");
}

function titleText(item) {
  return plainTextFromHtml(titleHtml(item)) || normalizeWhitespace(item.title);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isUrl(value) {
  return /^(https?:\/\/|www\.)\S+/i.test(String(value || "").trim());
}

function normalizeLink(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_LOOKUP = new Map([
  ["jan", 1], ["january", 1],
  ["feb", 2], ["february", 2],
  ["mar", 3], ["march", 3],
  ["apr", 4], ["april", 4],
  ["may", 5],
  ["jun", 6], ["june", 6],
  ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8],
  ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10],
  ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12]
]);

function normalizeYear(year) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 100 ? 2000 + numeric : numeric;
}

function validDateParts(month, day, year) {
  const y = normalizeYear(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { month: m, day: d, year: y };
}

function formatDateParts(parts) {
  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function formatDisplayDate(value) {
  const original = String(value || "").trim();
  if (!original) return "";
  const clean = original
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/[，]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  let match = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(clean);
  if (match) {
    const parts = validDateParts(match[2], match[3], match[1]);
    return parts ? formatDateParts(parts) : original;
  }

  match = /^(\d{4})(\d{2})(\d{2})$/.exec(clean);
  if (match) {
    const parts = validDateParts(match[2], match[3], match[1]);
    return parts ? formatDateParts(parts) : original;
  }

  match = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(clean);
  if (match) {
    const month = MONTH_LOOKUP.get(match[1].toLowerCase());
    const parts = validDateParts(month, match[2], match[3]);
    return parts ? formatDateParts(parts) : original;
  }

  match = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{2,4})$/.exec(clean);
  if (match) {
    const month = MONTH_LOOKUP.get(match[2].toLowerCase());
    const parts = validDateParts(month, match[1], match[3]);
    return parts ? formatDateParts(parts) : original;
  }

  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(clean);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second > 12 ? second : second;
    const parts = validDateParts(month, day, match[3]);
    return parts ? formatDateParts(parts) : original;
  }

  match = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(clean);
  if (match) {
    const parts = validDateParts(match[2], match[3], match[1]);
    return parts ? formatDateParts(parts) : original;
  }

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }

  return original;
}

function sourceFromLink(link) {
  try {
    const url = new URL(normalizeLink(link));
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function sourceName(item) {
  return sourceFromLink(item.link) || "Unknown";
}

function sourceDisplayName(source) {
  let cleaned = String(source || "Unknown").trim();
  cleaned = cleaned.replace(/^www\./i, "");
  cleaned = cleaned.split(".", 1)[0];
  cleaned = cleaned.replace(/[^A-Za-z0-9&' -]/g, "").trim();
  if (!cleaned) cleaned = "Unknown";
  return cleaned.slice(0, 1).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function sourceLabel(item) {
  return sourceDisplayName(sourceName(item));
}

function baseLogoName(name) {
  const cleaned = String(name || "Unknown").trim();
  return cleaned.includes(".") ? cleaned.split(".", 1)[0] : cleaned;
}

function missingLogoNoteName(name) {
  const cleaned = String(name || "Unknown").trim();
  const parts = cleaned ? cleaned.split(".") : [];
  return parts.length > 1 ? parts.slice(0, -1).join(".") : cleaned;
}

function preferredLogoName(name) {
  const preferred = missingLogoNoteName(String(name || "Unknown").trim());
  return preferred || String(name || "Unknown").trim();
}

function logoNameCandidates(name) {
  const names = [];
  const cleaned = String(name || "").trim();
  const baseName = baseLogoName(cleaned);
  const noteName = missingLogoNoteName(cleaned);
  const parts = cleaned ? cleaned.split(".") : [];
  const countryName = parts.length > 2 ? `${baseName}-${parts.at(-1)}` : "";
  for (const candidate of [cleaned, noteName, baseName, countryName, `${baseName}.com`]) {
    if (candidate && !names.includes(candidate)) names.push(candidate);
  }
  return names;
}

function logoLookupKey(value) {
  return String(value || "").trim().toLowerCase();
}

function logoForSource(source) {
  for (const candidate of logoNameCandidates(source)) {
    const raw = state.logos.get(logoLookupKey(candidate));
    if (raw) return raw;
    const clean = state.logos.get(slug(candidate));
    if (clean) return clean;
  }
  return null;
}

function sourceLogo(item) {
  return logoForSource(sourceName(item));
}

function missingLogoSearchUrl(source) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${source || "Unknown"} logo`)}`;
}

function missingLogoEntries() {
  const byName = new Map();
  for (const item of state.items) {
    const source = sourceName(item);
    if (logoForSource(source)) continue;
    byName.set(missingLogoNoteName(source), {
      name: missingLogoNoteName(source),
      searchName: source,
      searchUrl: missingLogoSearchUrl(source)
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function createId(index) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
}

function logoOffset(item) {
  const offset = item.logoOffset || {};
  return {
    x: Number(offset.x) || 0,
    y: Number(offset.y) || 0,
    scale: Number(offset.scale) || 1
  };
}

function setLogoOffset(item, x, y, scale = logoOffset(item).scale) {
  item.logoOffset = { x, y, scale };
}

function parseTsvClipboard(text) {
  const input = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"" && cell.length === 0) {
      inQuotes = true;
    } else if (char === "\t") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function looksLikeHeader(row) {
  const cells = row.map((cell) => slug(cell).replace(/-/g, " "));
  const score = cells.filter((cell) => HEADER_WORDS.has(cell)).length;
  return score >= 2 && !row.some(isUrl);
}

function rowToItem(row, index) {
  const cells = row.map((cell) => normalizeWhitespace(cell));
  const urlIndex = cells.findIndex(isUrl);
  const link = urlIndex >= 0 ? normalizeLink(cells[urlIndex]) : normalizeLink(cells[3] || "");

  let date = formatDisplayDate(cells[0] || "");
  let number = "";
  let title = "";

  if (cells.length >= 4) {
    number = cells[1] || "";
    title = cells[2] || "";
  } else if (cells.length === 3) {
    title = cells[1] || "";
  } else if (cells.length === 2) {
    title = urlIndex === 0 ? cells[1] : cells[0];
    date = "";
  } else {
    title = cells[0] || "";
    date = "";
  }

  if (!title && urlIndex > 0) {
    title = cells
      .filter((_, cellIndex) => cellIndex !== urlIndex && cellIndex !== 0 && cellIndex !== 1)
      .join(" ");
  }

  return {
    id: createId(index),
    date,
    number,
    title,
    titleHtml: escapeHtml(title),
    link,
    logoOffset: { x: 0, y: 0, scale: 1 },
    newsColor: "white"
  };
}

function parseExcelText(text) {
  const rows = parseTsvClipboard(text);
  if (!rows.length) return [];
  const dataRows = looksLikeHeader(rows[0]) ? rows.slice(1) : rows;
  return dataRows
    .map(rowToItem)
    .filter((item) => item.date || item.title || item.link);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed.");
  return json;
}

function setExportFolderUi(settings) {
  state.settings = settings;
  els.exportFolderInput.value = settings.exportFolderInput || settings.exportFolder || "";
  els.exportFolderInput.title = settings.exportFolder || "";
}

async function loadSettings() {
  const settings = await api("/api/settings");
  setExportFolderUi(settings);
}

async function saveExportFolder(silent = false) {
  const settings = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify({ exportFolder: els.exportFolderInput.value })
  });
  setExportFolderUi(settings);
  if (!silent) {
    els.exportStatus.textContent = `Export folder saved: ${settings.exportFolder}`;
  }
  return settings;
}

async function openExportFolder() {
  const settings = await saveExportFolder(true);
  await api("/api/open-export-folder", { method: "POST", body: "{}" });
  els.exportStatus.textContent = `Opened folder: ${settings.exportFolder}`;
}

function savedFileHtml(file) {
  if (file.url) {
    return `<a href="${file.url}" target="_blank">${escapeHtml(file.name)}</a>`;
  }
  return `<span class="saved-file">${escapeHtml(file.name)}</span>`;
}

async function loadLogos() {
  const data = await api("/api/logos");
  const logos = new Map();
  for (const logo of data.logos) {
    const rawKey = logoLookupKey(logo.key);
    if (rawKey && !logos.has(rawKey)) logos.set(rawKey, logo);
    const slugKey = slug(logo.key);
    if (slugKey && !logos.has(slugKey)) logos.set(slugKey, logo);
  }
  state.logos = logos;
  render();
}

function render() {
  renderItems();
}

function renderLogoSummary() {
  const sources = [...new Map(state.items.map((item) => [sourceName(item), sourceName(item)])).values()]
    .filter((source) => source && source !== "Unknown")
    .sort((a, b) => sourceDisplayName(a).localeCompare(sourceDisplayName(b)));

  if (!sources.length) {
    els.logoSummary.innerHTML = `<div class="empty-state compact">Sources appear after you paste news rows.</div>`;
    return;
  }

  els.logoSummary.innerHTML = sources.map((source) => {
    const label = sourceDisplayName(source);
    const logo = logoForSource(source);
    const icon = logo
      ? `<img src="${logo.url}" alt="${escapeHtml(label)} logo">`
      : `<div class="missing-logo">${escapeHtml(label.slice(0, 2).toUpperCase())}</div>`;
    return `
      <div class="source-chip" data-source="${escapeHtml(source)}">
        ${icon}
        <div>
          <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
          ${logo
            ? `<span>${escapeHtml(logo.file)}</span>`
            : `<a class="logo-search" href="${missingLogoSearchUrl(source)}" target="_blank" rel="noopener">Search logo</a>`}
        </div>
      </div>
    `;
  }).join("");

  els.logoSummary.querySelectorAll(".source-chip").forEach((chip) => {
    chip.tabIndex = 0;
    chip.title = "Click, then paste a logo image";
    chip.addEventListener("paste", (event) => handleLogoPasteForSource(event, chip.dataset.source));
    chip.addEventListener("click", () => chip.focus());
  });
}

function renderItems() {
  els.itemsEmpty.hidden = state.items.length > 0;
  els.itemsList.innerHTML = "";

  state.items.forEach((item, index) => {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    const logo = sourceLogo(item);
    const logoDrop = node.querySelector(".logo-drop");
    const logoImg = logoDrop.querySelector("img");
    const logoSource = node.querySelector(".logo-source");
    const searchLogo = node.querySelector(".search-logo");
    const itemPreview = node.querySelector(".item-preview");

    node.dataset.id = item.id;
    node.style.setProperty("--news-bg", newsBackground(item, index));
    node.querySelector(".number-badge").textContent = index + 1;

    const dateInput = node.querySelector(".date-input");
    const titleInput = node.querySelector(".title-input");
    const linkInput = node.querySelector(".link-input");
    const openLinkBtn = node.querySelector(".open-link");

    dateInput.value = formatDisplayDate(item.date);
    item.date = dateInput.value;
    item.titleHtml = titleHtml(item);
    item.title = titleText(item);
    titleInput.innerHTML = item.titleHtml;
    linkInput.value = item.link;
    logoSource.textContent = sourceLabel(item);

    if (logo) {
      logoDrop.classList.add("has-logo");
      logoImg.src = logo.url;
      logoImg.alt = `${sourceLabel(item)} logo`;
      const offset = logoOffset(item);
      logoImg.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${offset.scale})`;
      searchLogo.hidden = true;
    } else {
      searchLogo.href = missingLogoSearchUrl(sourceName(item));
      searchLogo.hidden = false;
    }

    dateInput.addEventListener("input", () => {
      item.date = dateInput.value;
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    dateInput.addEventListener("blur", () => {
      item.date = formatDisplayDate(dateInput.value);
      dateInput.value = item.date;
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    titleInput.addEventListener("input", () => {
      item.titleHtml = sanitizeRichHtml(titleInput.innerHTML);
      item.title = titleText(item);
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    titleInput.addEventListener("paste", pasteIntoTitle);
    titleInput.addEventListener("blur", () => {
      item.titleHtml = titleHtml(item);
      item.title = titleText(item);
      titleInput.innerHTML = item.titleHtml;
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    linkInput.addEventListener("input", () => {
      item.link = linkInput.value;
      logoSource.textContent = sourceLabel(item);
      searchLogo.href = missingLogoSearchUrl(sourceName(item));
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    linkInput.addEventListener("blur", () => {
      item.link = normalizeLink(linkInput.value);
      linkInput.value = item.link;
      render();
    });

    openLinkBtn.addEventListener("click", () => {
      if (!item.link) return;
      window.open(normalizeLink(item.link), "_blank", "noopener");
    });

    logoDrop.addEventListener("paste", (event) => handleLogoPaste(event, item));
    logoDrop.addEventListener("click", () => logoDrop.focus());
    node.querySelectorAll(".logo-nudge").forEach((button) => {
      button.addEventListener("click", () => {
        const offset = logoOffset(item);
        setLogoOffset(
          item,
          Math.max(-100, Math.min(100, offset.x + Number(button.dataset.dx || 0))),
          Math.max(-100, Math.min(100, offset.y + Number(button.dataset.dy || 0))),
          offset.scale
        );
        render();
      });
    });
    node.querySelectorAll(".logo-size").forEach((button) => {
      button.addEventListener("click", () => {
        const offset = logoOffset(item);
        setLogoOffset(
          item,
          offset.x,
          offset.y,
          Math.max(0.35, Math.min(2.2, offset.scale + Number(button.dataset.scale || 0)))
        );
        render();
      });
    });
    node.querySelector(".logo-reset").addEventListener("click", () => {
      setLogoOffset(item, 0, 0, 1);
      render();
    });

    node.querySelector(".remove-item").addEventListener("click", () => {
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      render();
    });

    itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    els.itemsList.appendChild(node);
  });
}

function commitItemFromCard(item, node) {
  const dateInput = node.querySelector(".date-input");
  const titleInput = node.querySelector(".title-input");
  const linkInput = node.querySelector(".link-input");
  item.date = formatDisplayDate(dateInput.value);
  item.titleHtml = sanitizeRichHtml(titleInput.innerHTML);
  item.title = titleText(item);
  item.link = normalizeLink(linkInput.value);
}

function commitVisibleItems() {
  els.itemsList.querySelectorAll(".news-card").forEach((node) => {
    const item = state.items.find((candidate) => candidate.id === node.dataset.id);
    if (item) commitItemFromCard(item, node);
  });
}

function renderItemPreviewHtml(item, index) {
  const logo = sourceLogo(item);
  const label = sourceLabel(item);
  const source = sourceName(item);
  const offset = logoOffset(item);
  const bg = newsBackground(item, index);
  const logoHtml = logo
    ? `<img src="${logo.url}" alt="${escapeHtml(label)} logo" style="transform: translate(${offset.x}px, ${offset.y}px) scale(${offset.scale})">`
    : `<a class="preview-search-logo" href="${missingLogoSearchUrl(source)}" target="_blank" rel="noopener">Search Logo</a>`;
  return `
    <article class="preview-item" style="--news-bg: ${bg}">
      <div class="preview-meta">
        <div class="preview-logo ${logo ? "has-logo" : "missing"}" title="${escapeHtml(label)}">
          ${logoHtml}
        </div>
        <div class="preview-date-source">
          <span class="preview-date">${escapeHtml(formatDisplayDate(item.date) || "Date")}</span>
          <span class="preview-source"> | ${escapeHtml(source)}</span>
        </div>
      </div>
      <h3 class="preview-title">${renderTitleHtml(item) || "Untitled headline"}</h3>
    </article>
  `;
}

function renderPreview() {}

async function handleLogoPaste(event, item) {
  return handleLogoPasteForSource(event, sourceName(item));
}

async function handleLogoPasteForSource(event, source) {
  const imageFile = [...event.clipboardData.items]
    .find((entry) => entry.type.startsWith("image/"))
    ?.getAsFile();
  if (!imageFile) return;

  event.preventDefault();
  try {
    const dataUrl = await readFileAsDataUrl(imageFile);
    const saved = await api("/api/logo", {
      method: "POST",
      body: JSON.stringify({ source, dataUrl })
    });
    state.logos.set(logoLookupKey(saved.key), saved);
    state.logos.set(slug(saved.key), saved);
    render();
  } catch (error) {
    alert(error.message);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pasteIntoTitle(event) {
  event.preventDefault();
  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");
  const insertHtml = html ? sanitizeRichHtml(html) : escapeHtml(text);
  document.execCommand("insertHTML", false, insertHtml);
}

function createItemsFromPaste() {
  const items = parseExcelText(els.excelPaste.value);
  state.items = items;
  if (newsColorMode() === "random") assignRandomNewsColors();
  els.parseStatus.textContent = items.length ? `${items.length} news sections created.` : "No rows found.";
  render();
}

function sampleText() {
  return [
    ["Date", "Number", "Title", "Link"].join("\t"),
    ["Jun 08, 2026", "202002", "Iran military announces halt to operation against Israel", "https://www.straitstimes.com/world/middle-east/iran-military-announces-halt-to-operation-against-israel"].join("\t"),
    ["05 Jun, 2026", "202002", "UN General Assembly unanimously adopted resolution Education for Peace initiative", "https://www.1lurer.am/en/2026/06/05/UN-General-Assembly-unanimously-adopted-resolution"].join("\t"),
    ["Jan. 17, 2026", "202002", "Russia and Ukraine agree to localized ceasefire for repairs at Zaporizhzhia nuclear plant", "https://www.themoscowtimes.com/2026/01/17/russia-and-ukraine-agree-to-localized-ceasefire"].join("\t")
  ].join("\n");
}

function collectExportHtml() {
  commitVisibleItems();
  const styles = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>News Export</title>
  <style>${styles}</style>
</head>
<body>
  <main class="preview-sheet">${state.items.map((item, index) => renderItemPreviewHtml(item, index)).join("")}</main>
</body>
</html>`;
}

function exportItems() {
  return state.items.map((item) => ({
    date: item.date,
    number: item.number,
    title: titleText(item),
    titleHtml: titleHtml(item),
    link: item.link,
    source: sourceLabel(item)
  }));
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    items: state.items,
    roundCorners: els.roundCorners.checked,
    newsColorMode: newsColorMode()
  }));
  els.parseStatus.textContent = "Draft saved in this browser.";
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    els.parseStatus.textContent = "No draft found in this browser.";
    return;
  }
  const draft = JSON.parse(raw);
  els.roundCorners.checked = Boolean(draft.roundCorners);
  els.newsColorMode.value = draft.newsColorMode || "white";
  state.items = Array.isArray(draft.items) ? draft.items : [];
  if (newsColorMode() === "random") {
    state.items.forEach((item, index) => {
      item.newsColor ||= RANDOM_COLOR_KEYS[index % RANDOM_COLOR_KEYS.length];
    });
  }
  els.parseStatus.textContent = `${state.items.length} draft sections loaded.`;
  render();
}

function fileSafePart(value, fallback) {
  return normalizeWhitespace(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;
}

function firstWords(value, count) {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

function pngFilename(item) {
  const date = fileSafePart(item.date, "undated");
  const headline = fileSafePart(firstWords(titleText(item), 10), "untitled");
  const source = fileSafePart(sourceLabel(item), "source");
  return `${date} ${headline} (${source}).png`;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["Untitled headline"];
}

function headlineSegments(item) {
  const template = document.createElement("template");
  template.innerHTML = renderTitleHtml(item);
  const segments = [];

  function walk(node, bold = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) segments.push({ text: text.replace(/\s+/g, " "), bold });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : "";
    if (tag === "br") {
      segments.push({ text: "\n", bold: false, break: true });
      return;
    }
    const nextBold = bold || tag === "b" || tag === "strong";
    node.childNodes.forEach((child) => walk(child, nextBold));
  }

  walk(template.content);
  if (!segments.length) segments.push({ text: titleText(item) || "Untitled headline", bold: false });
  return segments;
}

function headlineFont() {
  return "700 48px Georgia, 'Times New Roman', serif";
}

function measureHeadlinePart(ctx, text) {
  ctx.font = headlineFont();
  return ctx.measureText(text).width;
}

function wrapHeadlineSegments(ctx, segments, maxWidth) {
  const lines = [];
  let tokens = [];
  for (const segment of segments) {
    if (segment.break) {
      if (tokens.length) lines.push(wrapHeadlineTokens(ctx, tokens, maxWidth));
      else lines.push([[{ text: "", bold: false }]]);
      tokens = [];
      continue;
    }
    normalizeWhitespace(segment.text).split(" ").filter(Boolean).forEach((word) => {
      tokens.push({ text: word, bold: segment.bold });
    });
  }
  if (tokens.length) lines.push(wrapHeadlineTokens(ctx, tokens, maxWidth));
  const flat = lines.flat();
  return flat.length ? flat : [[{ text: "Untitled headline", bold: false }]];
}

function wrapHeadlineTokens(ctx, tokens, maxWidth) {
  const lines = [];
  let line = [];
  let width = 0;

  for (const token of tokens) {
    const text = line.length ? ` ${token.text}` : token.text;
    const partWidth = measureHeadlinePart(ctx, text);
    if (line.length && width + partWidth > maxWidth) {
      lines.push(line);
      line = [{ ...token, text: token.text }];
      width = measureHeadlinePart(ctx, token.text);
    } else {
      line.push({ ...token, text });
      width += partWidth;
    }
  }

  if (line.length) lines.push(line);
  return lines.length ? lines : [[{ text: "Untitled headline", bold: false }]];
}

function headlineLineWidth(ctx, line) {
  return line.reduce((total, part) => total + measureHeadlinePart(ctx, part.text), 0);
}

function drawHeadlineLines(ctx, lines, x, y) {
  ctx.textBaseline = "top";
  ctx.font = headlineFont();
  for (const line of lines) {
    let xText = x;
    for (const part of line) {
      const width = measureHeadlinePart(ctx, part.text);
      if (part.bold) {
        ctx.fillStyle = "rgba(255, 241, 118, 0.82)";
        drawRoundRect(ctx, xText - 4, y - 3, width + 8, 56, 4);
        ctx.fill();
      }
      ctx.fillStyle = "#000000";
      ctx.fillText(part.text, xText, y);
      xText += width;
    }
    y += 58;
  }
}

function roundedCanvasCopy(canvas, ratio = 0.15) {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext("2d");
  const radius = Math.min(canvas.width, canvas.height) * ratio;
  drawRoundRect(ctx, 0, 0, canvas.width, canvas.height, radius);
  ctx.clip();
  ctx.drawImage(canvas, 0, 0);
  return output;
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawContainImage(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function renderItemPng(item, index) {
  const logo = sourceLogo(item);
  const image = await loadImage(logo?.url);
  const logoHeight = 60;
  const logoWidth = image ? Math.max(1, Math.round(image.naturalWidth * (logoHeight / image.naturalHeight))) : 60;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const segments = headlineSegments(item);

  let wrapWidth = 800;
  let lines = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    lines = wrapHeadlineSegments(ctx, segments, wrapWidth - 40);
    if (lines.length <= 2 || wrapWidth >= 1500) break;
    wrapWidth += 50;
  }

  const maxLineWidth = Math.max(...lines.map((line) => headlineLineWidth(ctx, line)));
  ctx.font = "24px Arial, Helvetica, sans-serif";
  const dateWidth = ctx.measureText(item.date || "Date").width;
  ctx.font = "20px Arial, Helvetica, sans-serif";
  const source = sourceName(item);
  const sourceWidth = ctx.measureText(` | ${source}`).width;
  const metaWidth = logoWidth + 20 + dateWidth + 10 + sourceWidth;
  const finalWidth = Math.ceil(Math.max(800, maxLineWidth + 45, metaWidth + 45));
  const textHeight = lines.length * 58;
  const finalHeight = 20 + logoHeight + 20 + textHeight + 20;

  canvas.width = finalWidth;
  canvas.height = finalHeight;

  ctx.fillStyle = newsBackground(item, index);
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  if (image) {
    const offset = logoOffset(item);
    const scaledWidth = logoWidth * offset.scale;
    const scaledHeight = logoHeight * offset.scale;
    ctx.drawImage(image, 20 + offset.x, 20 + offset.y, scaledWidth, scaledHeight);
  }

  const dx = 20 + logoWidth + 20;
  const dy = 20 + (logoHeight - 24);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";
  ctx.font = "24px Arial, Helvetica, sans-serif";
  const displayDate = formatDisplayDate(item.date) || "Date";
  ctx.fillText(displayDate, dx, dy);
  const dw = ctx.measureText(displayDate).width;
  ctx.font = "20px Arial, Helvetica, sans-serif";
  ctx.fillText(` | ${source}`, dx + dw + 10, dy + 2);

  drawHeadlineLines(ctx, lines, 20, 100);
  const outputCanvas = els.roundCorners.checked ? roundedCanvasCopy(canvas, 0.05) : canvas;

  return {
    filename: pngFilename(item),
    dataUrl: outputCanvas.toDataURL("image/png")
  };
}

async function renderCurrentImages() {
  commitVisibleItems();
  const images = [];
  for (let index = 0; index < state.items.length; index += 1) {
    images.push(await renderItemPng(state.items[index], index));
  }
  return images;
}

async function renderPngList() {
  if (!state.items.length) {
    els.exportStatus.textContent = "Paste news first.";
    return;
  }

  els.pngExportBtn.disabled = true;
  els.exportStatus.textContent = "Rendering PNG list...";
  try {
    await saveExportFolder(true);
    const images = await renderCurrentImages();
    const result = await api("/api/png-export", {
      method: "POST",
      body: JSON.stringify({ images })
    });
    const missing = missingLogoEntries();
    let missingNote = "";
    if (missing.length) {
      await api("/api/missing-logos", {
        method: "POST",
        body: JSON.stringify({ missing })
      });
      missingNote = ` Missing logos: ${missing.map((entry) => `<a href="${entry.searchUrl}" target="_blank" rel="noopener">${escapeHtml(entry.name)}</a>`).join(" ")}`;
    }
    els.exportStatus.innerHTML = `${result.count} PNG files saved to <strong>${escapeHtml(result.exportFolder)}</strong>. ${result.files.map(savedFileHtml).join(" ")}${missingNote}`;
  } catch (error) {
    els.exportStatus.textContent = error.message;
  } finally {
    els.pngExportBtn.disabled = false;
  }
}

async function renderPngZip() {
  if (!state.items.length) {
    els.exportStatus.textContent = "Paste news first.";
    return;
  }

  els.zipExportBtn.disabled = true;
  els.exportStatus.textContent = "Rendering ZIP...";
  try {
    await saveExportFolder(true);
    const images = await renderCurrentImages();
    const result = await api("/api/png-zip", {
      method: "POST",
      body: JSON.stringify({ images })
    });
    const missing = missingLogoEntries();
    if (missing.length) {
      await api("/api/missing-logos", {
        method: "POST",
        body: JSON.stringify({ missing })
      });
    }
    els.exportStatus.innerHTML = `ZIP saved to <strong>${escapeHtml(result.exportFolder)}</strong>: ${savedFileHtml(result)}`;
  } catch (error) {
    els.exportStatus.textContent = error.message;
  } finally {
    els.zipExportBtn.disabled = false;
  }
}

els.parseBtn.addEventListener("click", createItemsFromPaste);
els.sampleBtn.addEventListener("click", () => {
  els.excelPaste.value = sampleText();
  createItemsFromPaste();
});
els.saveDraftBtn.addEventListener("click", saveDraft);
els.loadDraftBtn.addEventListener("click", loadDraft);
els.clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the current screen? Saved logos and exports will stay.")) return;
  state.items = [];
  els.excelPaste.value = "";
  els.parseStatus.textContent = "Screen cleared.";
  render();
});
els.saveExportBtn.addEventListener("click", async () => {
  try {
    commitVisibleItems();
    const result = await api("/api/export", {
      method: "POST",
      body: JSON.stringify({
        title: "News Export",
        items: exportItems(),
        html: collectExportHtml()
      })
    });
    els.exportStatus.innerHTML = `Saved export: <a href="${result.html}" target="_blank">HTML</a> and <a href="${result.json}" target="_blank">JSON</a>`;
  } catch (error) {
    els.exportStatus.textContent = error.message;
  }
});
els.saveExportFolderBtn.addEventListener("click", () => {
  saveExportFolder().catch((error) => {
    els.exportStatus.textContent = error.message;
  });
});
els.openExportFolderBtn.addEventListener("click", () => {
  openExportFolder().catch((error) => {
    els.exportStatus.textContent = error.message;
  });
});
els.pngExportBtn.addEventListener("click", renderPngList);
els.zipExportBtn.addEventListener("click", renderPngZip);
els.newsColorMode.addEventListener("change", () => {
  if (newsColorMode() === "random") assignRandomNewsColors();
  render();
});

loadSettings().catch((error) => {
  els.exportStatus.textContent = error.message;
});

loadLogos().catch((error) => {
  els.parseStatus.textContent = error.message;
  render();
});
