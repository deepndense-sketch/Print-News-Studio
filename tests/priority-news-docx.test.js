const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createPriorityNewsDocx,
  normalizePriorityNewsEntry,
  priorityNewsDefaultPath,
  priorityNewsDocumentXml,
  prioritySourceName,
  writePriorityNewsDocument
} = require("../server");

const sampleEntries = [
  {
    number: "202002",
    headline: "Iran military announces halt to operation against Israel",
    link: "https://www.straitstimes.com/world/middle-east/story"
  },
  {
    number: "#202002",
    headline: "UN General Assembly unanimously adopted resolution Education for Peace initiative",
    link: "https://www.1lurer.am/en/story"
  },
  {
    number: "202002",
    headline: "Russia and Ukraine agree to localized ceasefire for repairs at Zaporizhzhia nuclear plant",
    link: "https://www.themoscowtimes.com/story"
  }
];

test("uses the approved source names", () => {
  assert.equal(prioritySourceName(sampleEntries[0].link), "The Straits Times");
  assert.equal(prioritySourceName(sampleEntries[1].link), "1Lurer");
  assert.equal(prioritySourceName(sampleEntries[2].link), "The Moscow Times");
  assert.equal(prioritySourceName("https://www.reuters.com/world/story"), "reuters.com");
});

test("starts every session with a Priority News List folder beside the app", () => {
  const defaultPath = priorityNewsDefaultPath();
  assert.equal(path.basename(path.dirname(defaultPath)), "Priority News List");
  assert.match(path.basename(defaultPath), /^Priority News List \d{4}-\d{2}-\d{2}\.docx$/);
});

test("normalizes number, headline, and parenthesized source safely", () => {
  assert.deepEqual(
    normalizePriorityNewsEntry({
      number: "##202002",
      headline: "  Headline \n text ",
      source: "(Example News)"
    }),
    {
      number: "202002",
      headline: "Headline text",
      source: "Example News"
    }
  );
});

test("writes one 22 pt Times New Roman paragraph per item with only the number bold", () => {
  const xml = priorityNewsDocumentXml(sampleEntries);
  const paragraphs = xml.match(/<w:p>/g) || [];
  const boldRuns = xml.match(/<w:b\/>/g) || [];
  const fontSizes = xml.match(/<w:sz w:val="44"\/>/g) || [];

  assert.equal(paragraphs.length, 3);
  assert.equal(boldRuns.length, 3);
  assert.equal(fontSizes.length, 6);
  assert.match(xml, /<w:t xml:space="preserve">#202002<\/w:t>/);
  assert.match(xml, /<w:t xml:space="preserve"> Iran military announces halt to operation against Israel \(The Straits Times\)<\/w:t>/);
  assert.doesNotMatch(xml, /\[#202002\]/);
});

test("creates a DOCX package and safely replaces an existing file", () => {
  const buffer = createPriorityNewsDocx(sampleEntries);
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
  assert.ok(buffer.includes(Buffer.from("[Content_Types].xml")));
  assert.ok(buffer.includes(Buffer.from("word/document.xml")));

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "print-news-studio-"));
  const filePath = path.join(folder, "Priority News List.docx");
  try {
    fs.writeFileSync(filePath, "old");
    writePriorityNewsDocument(filePath, sampleEntries);
    const saved = fs.readFileSync(filePath);
    assert.equal(saved.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(saved.length > 1000);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
