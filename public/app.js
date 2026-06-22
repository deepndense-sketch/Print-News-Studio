const state = {
  items: [],
  logos: new Map(),
  fonts: [],
  fontFolder: "",
  pendingUpdate: null,
  settings: {
    exportFolder: "",
    exportFolderInput: "",
    defaultExportFolder: ""
  }
};

const els = {
  excelPaste: document.querySelector("#excelPaste"),
  pastePreview: document.querySelector("#pastePreview"),
  parseBtn: document.querySelector("#parseBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  addEmptyBtn: document.querySelector("#addEmptyBtn"),
  parseStatus: document.querySelector("#parseStatus"),
  itemsEmpty: document.querySelector("#itemsEmpty"),
  itemsList: document.querySelector("#itemsList"),
  previewList: document.querySelector("#previewList"),
  itemTemplate: document.querySelector("#itemTemplate"),
  updateBtn: document.querySelector("#updateBtn"),
  installUpdateBtn: document.querySelector("#installUpdateBtn"),
  updateStatus: document.querySelector("#updateStatus"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  loadDraftBtn: document.querySelector("#loadDraftBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  shutdownBtn: document.querySelector("#shutdownBtn"),
  roundCorners: document.querySelector("#roundCorners"),
  exportFolderInput: document.querySelector("#exportFolderInput"),
  saveExportFolderBtn: document.querySelector("#saveExportFolderBtn"),
  openExportFolderBtn: document.querySelector("#openExportFolderBtn"),
  newsColorMode: document.querySelector("#newsColorMode"),
  aulaceseFontSelect: document.querySelector("#aulaceseFontSelect"),
  englishFontSelect: document.querySelector("#englishFontSelect"),
  fontFolderInput: document.querySelector("#fontFolderInput"),
  chooseFontFolderBtn: document.querySelector("#chooseFontFolderBtn"),
  saveFontFolderBtn: document.querySelector("#saveFontFolderBtn"),
  openFontFolderBtn: document.querySelector("#openFontFolderBtn"),
  pngExportBtn: document.querySelector("#pngExportBtn"),
  zipExportBtn: document.querySelector("#zipExportBtn"),
  exportStatus: document.querySelector("#exportStatus")
};

const DRAFT_KEY = "print-news-studio-draft-v2";
const FONT_PREF_KEY = "print-news-studio-font-preferences-v1";
const DEFAULT_AULACESE_FONT_KEY = "BarlowCondensed-Bold";
const DEFAULT_ENGLISH_FONT_KEY = "Poppins-Bold";
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

function aulaceseFontKey() {
  return els.aulaceseFontSelect?.value || "";
}

function englishFontKey() {
  return els.englishFontSelect?.value || "random";
}

function fontByKey(key) {
  return state.fonts.find((font) => font.key === key) || null;
}

function readFontPreferences() {
  try {
    return JSON.parse(localStorage.getItem(FONT_PREF_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveFontPreferences() {
  localStorage.setItem(FONT_PREF_KEY, JSON.stringify({
    aulaceseFontKey: aulaceseFontKey(),
    englishFontKey: englishFontKey()
  }));
}

function preferredAulaceseFontKey(previous = null) {
  const preferences = readFontPreferences();
  const hasPreference = Object.prototype.hasOwnProperty.call(preferences, "aulaceseFontKey");
  const candidates = [
    hasPreference ? preferences.aulaceseFontKey : null,
    previous,
    DEFAULT_AULACESE_FONT_KEY,
    state.fonts[0]?.key,
    ""
  ];
  return candidates.find((key) => key != null && (key === "" || fontByKey(key))) || "";
}

function preferredEnglishFontKey(previous = null) {
  const preferences = readFontPreferences();
  const hasPreference = Object.prototype.hasOwnProperty.call(preferences, "englishFontKey");
  const candidates = [
    hasPreference ? preferences.englishFontKey : null,
    previous,
    DEFAULT_ENGLISH_FONT_KEY,
    "random",
    state.fonts[0]?.key,
    ""
  ];
  return candidates.find((key) => key != null && (key === "random" || key === "" || fontByKey(key))) || "random";
}

function isAulaceseItem(item) {
  return /\/\//.test(titleHtml(item));
}

function fallbackHeadlineStack() {
  return 'Georgia, "Times New Roman", serif';
}

function fontStackForKey(key) {
  const font = fontByKey(key);
  return font ? `${font.family}, ${fallbackHeadlineStack()}` : fallbackHeadlineStack();
}

function chooseRandomEnglishFont(item) {
  if (!state.fonts.length) return "";
  const available = new Set(state.fonts.map((font) => font.key));
  if (!item.randomEnglishFontKey || !available.has(item.randomEnglishFontKey)) {
    item.randomEnglishFontKey = state.fonts[Math.floor(Math.random() * state.fonts.length)].key;
  }
  return item.randomEnglishFontKey;
}

function headlineFontKey(item, index) {
  if (isAulaceseItem(item)) {
    return aulaceseFontKey();
  }

  const selected = englishFontKey();
  if (selected === "random") return chooseRandomEnglishFont(item);
  return selected;
}

function headlineFontStack(item, index) {
  return fontStackForKey(headlineFontKey(item, index));
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

function subTextHtml(item) {
  const html = item.subTextHtml || escapeHtml(item.subText || "");
  return sanitizeRichHtml(html);
}

function subTextValue(item) {
  return plainTextFromHtml(subTextHtml(item));
}

function renderSubTextHtml(item) {
  return subTextHtml(item);
}

function caretCharacterOffsetWithin(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function restoreCaretByCharacterOffset(element, offset) {
  if (offset == null || document.activeElement !== element) return;
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function normalizeRichEditor(editor) {
  const clean = sanitizeRichHtml(editor.innerHTML);
  if (editor.innerHTML !== clean) {
    const offset = caretCharacterOffsetWithin(editor);
    editor.innerHTML = clean;
    restoreCaretByCharacterOffset(editor, offset);
  }
  return clean;
}

function applyRichHighlight(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return document.execCommand("bold", false, null);
  }
  if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const strong = document.createElement("strong");
  strong.appendChild(range.extractContents());
  range.insertNode(strong);

  const nextRange = document.createRange();
  nextRange.selectNodeContents(strong);
  nextRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  normalizeRichEditor(editor);
  return true;
}

function updateTitleFromInput(titleInput, item, itemPreview, index, normalizeEditor = false) {
  item.titleHtml = normalizeEditor ? normalizeRichEditor(titleInput) : sanitizeRichHtml(titleInput.innerHTML);
  item.title = titleText(item);
  itemPreview.innerHTML = renderItemPreviewHtml(item, index);
}

function updateSubTextFromInput(subTextInput, item, itemPreview, index, normalizeEditor = false) {
  item.subTextHtml = normalizeEditor ? normalizeRichEditor(subTextInput) : sanitizeRichHtml(subTextInput.innerHTML);
  item.subText = subTextValue(item);
  itemPreview.innerHTML = renderItemPreviewHtml(item, index);
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
  return String(name || "Unknown").trim();
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

function logoNeedsFullName(source, logo) {
  if (!logo) return false;
  const expected = logoLookupKey(preferredLogoName(source));
  const current = logoLookupKey(logo.key);
  return expected && current && expected.includes(".") && current !== expected;
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

function emptyItem(index = 0) {
  return {
    id: createId(index),
    date: "",
    number: "",
    title: "",
    titleHtml: "",
    subText: "",
    subTextOpen: false,
    link: "",
    logoOffset: { x: 0, y: 0, scale: 1 },
    newsColor: "white"
  };
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
    subText: "",
    subTextOpen: false,
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

function pastePreviewRows(text) {
  const rows = parseTsvClipboard(text);
  if (!rows.length) return [];
  return (looksLikeHeader(rows[0]) ? rows.slice(1) : rows)
    .map((row) => row.map((cell) => normalizeWhitespace(cell)))
    .filter((row) => row.some(Boolean));
}

function pastePreviewRowHtml(row) {
  const linkIndex = row.findIndex(isUrl);
  const date = row[0] || "";
  const number = row[1] || "";
  const title = row[2] || "";
  const link = linkIndex >= 0 ? row[linkIndex] : row[3] || "";
  return `
    <div class="paste-preview-row">
      <span class="paste-preview-cell" title="${escapeHtml(date)}">${escapeHtml(date)}</span>
      <span class="paste-preview-cell" title="${escapeHtml(number)}">${escapeHtml(number)}</span>
      <span class="paste-preview-cell paste-preview-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
      <span class="paste-preview-cell" title="${escapeHtml(link)}">${escapeHtml(link)}</span>
    </div>
  `;
}

function renderPastePreview() {
  if (!els.pastePreview) return;
  const rows = pastePreviewRows(els.excelPaste.value);
  els.pastePreview.hidden = rows.length === 0;
  els.pastePreview.innerHTML = rows.length
    ? `<div class="paste-preview-table">${rows.map(pastePreviewRowHtml).join("")}</div>`
    : "";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    const message = normalizeWhitespace(text) || "The app returned unreadable data.";
    throw new Error(message === "Not found"
      ? "Close Print News Studio and open it again, then try this button once more."
      : message);
  }
  if (!res.ok) throw new Error(json.error || "Request failed.");
  return json;
}

function setExportFolderUi(settings) {
  state.settings = settings;
  els.exportFolderInput.value = settings.exportFolderInput || settings.exportFolder || "";
  els.exportFolderInput.title = settings.exportFolder || "";
}

function setFontFolderUi(settings) {
  state.fontFolder = settings.fontFolder || "";
  els.fontFolderInput.value = settings.fontFolderInput || settings.fontFolder || "";
  els.fontFolderInput.title = settings.fontFolder || "";
}

async function loadSettings() {
  const settings = await api("/api/settings");
  setExportFolderUi(settings);
  setFontFolderUi(settings);
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

async function saveFontFolder(silent = false) {
  const settings = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify({ fontFolder: els.fontFolderInput.value })
  });
  setFontFolderUi(settings);
  const count = await loadFonts();
  if (!silent) {
    els.parseStatus.textContent = `Font folder saved: ${settings.fontFolder}. ${count} fonts found.`;
  }
  return settings;
}

function savedFileHtml(file) {
  if (file.url) {
    return `<a href="${file.url}" target="_blank">${escapeHtml(file.name)}</a>`;
  }
  return `<span class="saved-file">${escapeHtml(file.name)}</span>`;
}

async function loadFonts() {
  const data = await api("/api/fonts");
  setFontFolderUi(data);
  state.fonts = Array.isArray(data.fonts) ? data.fonts : [];
  applyFontFaceStyles();
  renderFontOptions();
  render();
  return state.fonts.length;
}

function applyFontFaceStyles() {
  let style = document.querySelector("#dynamicFontFaces");
  if (!style) {
    style = document.createElement("style");
    style.id = "dynamicFontFaces";
    document.head.appendChild(style);
  }

  style.textContent = state.fonts
    .map((font) => `@font-face { font-family: "${font.family}"; src: url("${font.url}"); font-weight: 400 900; }`)
    .join("\n");
}

function fontOptionHtml(font) {
  return `<option value="${escapeHtml(font.key)}">${escapeHtml(font.key)}</option>`;
}

function setSelectValue(select, value, fallback) {
  const values = [...select.options].map((option) => option.value);
  select.value = values.includes(value) ? value : fallback;
}

function renderFontOptions() {
  const currentAulacese = els.aulaceseFontSelect.options.length ? els.aulaceseFontSelect.value : null;
  const currentEnglish = els.englishFontSelect.options.length ? els.englishFontSelect.value : null;
  const fontOptions = state.fonts.map(fontOptionHtml).join("");

  els.aulaceseFontSelect.innerHTML = `<option value="">Default</option>${fontOptions}`;
  els.englishFontSelect.innerHTML = `<option value="random">Random</option><option value="">Default</option>${fontOptions}`;
  setSelectValue(els.aulaceseFontSelect, preferredAulaceseFontKey(currentAulacese), "");
  setSelectValue(els.englishFontSelect, preferredEnglishFontKey(currentEnglish), "random");
}

async function openFontFolder() {
  const settings = await saveFontFolder(true);
  const result = await api("/api/open-font-folder", { method: "POST", body: "{}" });
  els.parseStatus.textContent = `Font folder opened: ${result.fontFolder || settings.fontFolder}`;
}

async function chooseFontFolder() {
  const result = await api("/api/choose-font-folder", {
    method: "POST",
    body: JSON.stringify({ fontFolder: els.fontFolderInput.value })
  });
  setFontFolderUi(result);
  const count = await loadFonts();
  els.parseStatus.textContent = result.canceled
    ? `Font folder unchanged: ${result.fontFolder}. ${count} fonts found.`
    : `Font folder selected: ${result.fontFolder}. ${count} fonts found.`;
}

async function checkForUpdate() {
  els.updateBtn.disabled = true;
  els.installUpdateBtn.hidden = true;
  state.pendingUpdate = null;
  els.updateStatus.textContent = "Checking update...";
  try {
    const result = await api("/api/update-check");
    if (result.error) {
      els.updateStatus.textContent = `Version ${result.currentVersion}. Could not check update.`;
      return;
    }
    if (result.updateAvailable) {
      state.pendingUpdate = result;
      els.installUpdateBtn.hidden = false;
      els.updateStatus.textContent = `New version ${result.latestVersion} is available. Click Update App to install and keep your fonts, logos, and exports.`;
      return;
    }
    els.updateStatus.textContent = `Version ${result.currentVersion} is current.`;
  } catch (error) {
    els.updateStatus.textContent = error.message;
  } finally {
    els.updateBtn.disabled = false;
  }
}

async function installAppUpdate() {
  if (!state.pendingUpdate) {
    await checkForUpdate();
    if (!state.pendingUpdate) return;
  }
  if (!confirm("Update Print News Studio now? Your fonts, logos, exports, and settings will stay.")) return;
  els.updateBtn.disabled = true;
  els.installUpdateBtn.disabled = true;
  els.updateStatus.textContent = "Downloading and installing update...";
  try {
    const result = await api("/api/update-install", { method: "POST", body: "{}" });
    els.updateStatus.textContent = result.message || "Update is installing. The app will close and reopen.";
  } catch (error) {
    els.updateStatus.textContent = error.message;
    els.updateBtn.disabled = false;
    els.installUpdateBtn.disabled = false;
  }
}

async function shutdownApp() {
  if (!confirm("Turn off Print News Studio? Open PrintNewsStudio.exe again when you want to restart.")) return;
  els.shutdownBtn.disabled = true;
  els.updateStatus.textContent = "Turning off Print News Studio...";
  try {
    const result = await api("/api/shutdown", { method: "POST", body: "{}" });
    els.updateStatus.textContent = result.message || "Print News Studio is turning off.";
  } catch (error) {
    els.updateStatus.textContent = error.message;
    els.shutdownBtn.disabled = false;
  }
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
  renderLogoSummary();
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
    const renameButton = logoNeedsFullName(source, logo)
      ? `<button class="logo-rename" type="button" data-source="${escapeHtml(source)}" data-file="${escapeHtml(logo.file)}">Change name</button>`
      : "";
    const icon = logo
      ? `<img src="${logo.url}" alt="${escapeHtml(label)} logo">`
      : `<div class="missing-logo">${escapeHtml(label.slice(0, 2).toUpperCase())}</div>`;
    return `
      <div class="source-chip" data-source="${escapeHtml(source)}">
        ${icon}
        <div>
          <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
          ${logo
            ? `<span>${escapeHtml(logo.file)}</span>${renameButton}`
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

  els.logoSummary.querySelectorAll(".logo-rename").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        const saved = await api("/api/logo-rename", {
          method: "POST",
          body: JSON.stringify({
            source: button.dataset.source,
            file: button.dataset.file
          })
        });
        state.logos.set(logoLookupKey(saved.key), saved);
        state.logos.set(slug(saved.key), saved);
        await loadLogos();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
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
    const subTextToggle = node.querySelector(".subtext-toggle");
    const subTextInput = node.querySelector(".subtext-input");
    const linkInput = node.querySelector(".link-input");
    const openLinkBtn = node.querySelector(".open-link");

    dateInput.value = formatDisplayDate(item.date);
    item.date = dateInput.value;
    item.titleHtml = titleHtml(item);
    item.title = titleText(item);
    titleInput.innerHTML = item.titleHtml;
    if (typeof item.subTextOpen !== "boolean") item.subTextOpen = false;
    item.subTextHtml = subTextHtml(item);
    item.subText = subTextValue(item);
    subTextInput.innerHTML = item.subTextHtml;
    subTextInput.hidden = !item.subTextOpen;
    subTextToggle.classList.toggle("active", item.subTextOpen);
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
      updateTitleFromInput(titleInput, item, itemPreview, index, /font-weight|<b\b|<strong\b/i.test(titleInput.innerHTML));
    });
    titleInput.addEventListener("beforeinput", (event) => {
      if (event.inputType !== "formatBold") return;
      event.preventDefault();
      applyRichHighlight(titleInput);
      updateTitleFromInput(titleInput, item, itemPreview, index, true);
    });
    titleInput.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      applyRichHighlight(titleInput);
      updateTitleFromInput(titleInput, item, itemPreview, index, true);
    });
    titleInput.addEventListener("paste", (event) => {
      pasteIntoTitle(event);
      window.setTimeout(() => {
        updateTitleFromInput(titleInput, item, itemPreview, index, true);
      }, 0);
    });
    titleInput.addEventListener("blur", () => {
      item.titleHtml = titleHtml(item);
      item.title = titleText(item);
      titleInput.innerHTML = item.titleHtml;
      itemPreview.innerHTML = renderItemPreviewHtml(item, index);
    });
    subTextToggle.addEventListener("click", () => {
      item.subTextOpen = !item.subTextOpen;
      render();
    });
    subTextInput.addEventListener("input", () => {
      updateSubTextFromInput(subTextInput, item, itemPreview, index, /font-weight|<b\b|<strong\b/i.test(subTextInput.innerHTML));
    });
    subTextInput.addEventListener("beforeinput", (event) => {
      if (event.inputType !== "formatBold") return;
      event.preventDefault();
      applyRichHighlight(subTextInput);
      updateSubTextFromInput(subTextInput, item, itemPreview, index, true);
    });
    subTextInput.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      applyRichHighlight(subTextInput);
      updateSubTextFromInput(subTextInput, item, itemPreview, index, true);
    });
    subTextInput.addEventListener("paste", (event) => {
      pasteIntoTitle(event);
      window.setTimeout(() => {
        updateSubTextFromInput(subTextInput, item, itemPreview, index, true);
      }, 0);
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
  const subTextInput = node.querySelector(".subtext-input");
  const linkInput = node.querySelector(".link-input");
  item.date = formatDisplayDate(dateInput.value);
  item.titleHtml = sanitizeRichHtml(titleInput.innerHTML);
  item.title = titleText(item);
  item.subTextHtml = sanitizeRichHtml(subTextInput?.innerHTML || "");
  item.subText = subTextValue(item);
  item.subTextOpen = Boolean(subTextInput && !subTextInput.hidden);
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
  const subText = subTextValue(item);
  const subTextPreviewHtml = subText ? `<p class="preview-subtext">${renderSubTextHtml(item)}</p>` : "";
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
      <h3 class="preview-title" style="font-family: ${escapeHtml(headlineFontStack(item, index))}">${renderTitleHtml(item) || "Untitled headline"}</h3>
      ${subTextPreviewHtml}
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
  renderPastePreview();
  const items = parseExcelText(els.excelPaste.value);
  state.items = items;
  if (newsColorMode() === "random") assignRandomNewsColors();
  els.parseStatus.textContent = items.length ? `${items.length} news sections created.` : "No rows found.";
  render();
}

function addEmptyItem() {
  commitVisibleItems();
  state.items.push(emptyItem(state.items.length));
  if (newsColorMode() === "random") assignRandomNewsColors();
  els.parseStatus.textContent = "Empty news section added.";
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
  const fontFaceStyles = state.fonts
    .map((font) => `@font-face { font-family: ${font.family}; src: url("${font.url}"); }`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>News Export</title>
  <style>${fontFaceStyles}\n${styles}</style>
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
    subText: subTextValue(item),
    subTextHtml: subTextHtml(item),
    link: item.link,
    source: sourceLabel(item)
  }));
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    items: state.items,
    roundCorners: els.roundCorners.checked,
    newsColorMode: newsColorMode(),
    aulaceseFontKey: aulaceseFontKey(),
    englishFontKey: englishFontKey()
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
  setSelectValue(els.aulaceseFontSelect, draft.aulaceseFontKey || "", "");
  setSelectValue(els.englishFontSelect, draft.englishFontKey || "random", "random");
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

function wrapCanvasText(ctx, text, maxWidth, fallback = "Untitled headline") {
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
  return lines.length ? lines : (fallback ? [fallback] : []);
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

function subTextSegments(item) {
  const template = document.createElement("template");
  template.innerHTML = renderSubTextHtml(item);
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
  return segments;
}

function headlineFont(item, index) {
  return `700 48px ${headlineFontStack(item, index)}`;
}

function measureHeadlinePart(ctx, text, item, index) {
  ctx.font = headlineFont(item, index);
  return ctx.measureText(text).width;
}

function wrapHeadlineSegments(ctx, segments, maxWidth, item, index) {
  const lines = [];
  let tokens = [];
  for (const segment of segments) {
    if (segment.break) {
      if (tokens.length) lines.push(wrapHeadlineTokens(ctx, tokens, maxWidth, item, index));
      else lines.push([[{ text: "", bold: false }]]);
      tokens = [];
      continue;
    }
    normalizeWhitespace(segment.text).split(" ").filter(Boolean).forEach((word) => {
      tokens.push({ text: word, bold: segment.bold });
    });
  }
  if (tokens.length) lines.push(wrapHeadlineTokens(ctx, tokens, maxWidth, item, index));
  const flat = lines.flat();
  return flat.length ? flat : [[{ text: "Untitled headline", bold: false }]];
}

function wrapHeadlineTokens(ctx, tokens, maxWidth, item, index) {
  const lines = [];
  let line = [];
  let width = 0;

  for (const token of tokens) {
    const text = line.length ? ` ${token.text}` : token.text;
    const partWidth = measureHeadlinePart(ctx, text, item, index);
    if (line.length && width + partWidth > maxWidth) {
      lines.push(line);
      line = [{ ...token, text: token.text }];
      width = measureHeadlinePart(ctx, token.text, item, index);
    } else {
      line.push({ ...token, text });
      width += partWidth;
    }
  }

  if (line.length) lines.push(line);
  return lines.length ? lines : [[{ text: "Untitled headline", bold: false }]];
}

function headlineLineWidth(ctx, line, item, index) {
  return line.reduce((total, part) => total + measureHeadlinePart(ctx, part.text, item, index), 0);
}

function drawHeadlineLines(ctx, lines, x, y, item, index) {
  ctx.textBaseline = "top";
  ctx.font = headlineFont(item, index);
  for (const line of lines) {
    let xText = x;
    for (const part of line) {
      const width = measureHeadlinePart(ctx, part.text, item, index);
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

function subTextFont() {
  return '400 42.24px "Times New Roman", Times, serif';
}

function measureSubTextPart(ctx, text) {
  ctx.font = subTextFont();
  return ctx.measureText(text).width;
}

function wrapSubTextSegments(ctx, segments, maxWidth) {
  const lines = [];
  let tokens = [];
  for (const segment of segments) {
    if (segment.break) {
      if (tokens.length) lines.push(wrapSubTextTokens(ctx, tokens, maxWidth));
      tokens = [];
      continue;
    }
    normalizeWhitespace(segment.text).split(" ").filter(Boolean).forEach((word) => {
      tokens.push({ text: word, bold: segment.bold });
    });
  }
  if (tokens.length) lines.push(wrapSubTextTokens(ctx, tokens, maxWidth));
  return lines.flat();
}

function wrapSubTextTokens(ctx, tokens, maxWidth) {
  const lines = [];
  let line = [];
  let width = 0;

  for (const token of tokens) {
    const text = line.length ? ` ${token.text}` : token.text;
    const partWidth = measureSubTextPart(ctx, text);
    if (line.length && width + partWidth > maxWidth) {
      lines.push(line);
      line = [{ ...token, text: token.text }];
      width = measureSubTextPart(ctx, token.text);
    } else {
      line.push({ ...token, text });
      width += partWidth;
    }
  }

  if (line.length) lines.push(line);
  return lines;
}

function drawSubTextLines(ctx, lines, x, y) {
  ctx.textBaseline = "top";
  ctx.font = subTextFont();
  for (const line of lines) {
    let xText = x;
    for (const part of line) {
      const width = measureSubTextPart(ctx, part.text);
      if (part.bold) {
        ctx.fillStyle = "rgba(255, 241, 118, 0.82)";
        drawRoundRect(ctx, xText - 4, y - 4, width + 8, 50, 4);
        ctx.fill();
      }
      ctx.fillStyle = "#000000";
      ctx.fillText(part.text, xText, y);
      xText += width;
    }
    y += 52;
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
    lines = wrapHeadlineSegments(ctx, segments, wrapWidth - 40, item, index);
    if (lines.length <= 2 || wrapWidth >= 1500) break;
    wrapWidth += 50;
  }

  const maxLineWidth = Math.max(...lines.map((line) => headlineLineWidth(ctx, line, item, index)));
  ctx.font = "24px Arial, Helvetica, sans-serif";
  const dateWidth = ctx.measureText(item.date || "Date").width;
  ctx.font = "20px Arial, Helvetica, sans-serif";
  const source = sourceName(item);
  const sourceWidth = ctx.measureText(` | ${source}`).width;
  const metaWidth = logoWidth + 20 + dateWidth + 10 + sourceWidth;
  const finalWidth = Math.ceil(Math.max(800, maxLineWidth + 45, metaWidth + 45));
  ctx.font = subTextFont();
  const subTextLines = subTextValue(item) ? wrapSubTextSegments(ctx, subTextSegments(item), finalWidth - 40) : [];
  const textHeight = lines.length * 58;
  const subTextHeight = subTextLines.length ? 14 + subTextLines.length * 52 : 0;
  const finalHeight = 20 + logoHeight + 20 + textHeight + subTextHeight + 20;

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

  drawHeadlineLines(ctx, lines, 20, 100, item, index);
  if (subTextLines.length) {
    drawSubTextLines(ctx, subTextLines, 20, 100 + textHeight + 14);
  }
  const outputCanvas = els.roundCorners.checked ? roundedCanvasCopy(canvas, 0.05) : canvas;

  return {
    filename: pngFilename(item),
    dataUrl: outputCanvas.toDataURL("image/png")
  };
}

async function ensureHeadlineFontsReady() {
  if (!document.fonts?.load) return;

  const keys = new Set();
  state.items.forEach((item, index) => {
    const key = headlineFontKey(item, index);
    if (key) keys.add(key);
  });

  await Promise.all([...keys].map(async (key) => {
    const font = fontByKey(key);
    if (!font) return;
    try {
      await document.fonts.load(`700 48px "${font.family}"`);
    } catch {
      // Keep exporting with fallback if a copied font file is unreadable.
    }
  }));

  if (document.fonts.ready) {
    await document.fonts.ready;
  }
}

async function renderCurrentImages() {
  commitVisibleItems();
  await ensureHeadlineFontsReady();
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
els.addEmptyBtn.addEventListener("click", addEmptyItem);
els.updateBtn.addEventListener("click", checkForUpdate);
els.installUpdateBtn.addEventListener("click", installAppUpdate);
els.shutdownBtn.addEventListener("click", shutdownApp);
els.excelPaste.addEventListener("input", renderPastePreview);
els.sampleBtn.addEventListener("click", () => {
  els.excelPaste.value = sampleText();
  renderPastePreview();
  createItemsFromPaste();
});
els.saveDraftBtn.addEventListener("click", saveDraft);
els.loadDraftBtn.addEventListener("click", loadDraft);
els.clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the current screen? Saved logos and exports will stay.")) return;
  state.items = [];
  els.excelPaste.value = "";
  renderPastePreview();
  els.parseStatus.textContent = "Screen cleared.";
  render();
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
els.aulaceseFontSelect.addEventListener("change", () => {
  saveFontPreferences();
  render();
});
els.englishFontSelect.addEventListener("change", () => {
  saveFontPreferences();
  if (englishFontKey() === "random") {
    state.items.forEach((item) => {
      delete item.randomEnglishFontKey;
    });
  }
  render();
});
els.chooseFontFolderBtn.addEventListener("click", () => {
  chooseFontFolder().catch((error) => {
    els.parseStatus.textContent = error.message;
  });
});
els.saveFontFolderBtn.addEventListener("click", () => {
  saveFontFolder().catch((error) => {
    els.parseStatus.textContent = error.message;
  });
});
els.openFontFolderBtn.addEventListener("click", () => {
  openFontFolder().catch((error) => {
    els.parseStatus.textContent = error.message;
  });
});

loadSettings().catch((error) => {
  els.exportStatus.textContent = error.message;
});

loadFonts()
  .then((count) => {
    if (!count) {
      els.parseStatus.textContent = "No headline fonts found. Click Choose or copy font files into the font folder.";
    }
  })
  .catch((error) => {
    els.parseStatus.textContent = error.message;
  });

loadLogos().catch((error) => {
  els.parseStatus.textContent = error.message;
  render();
});
