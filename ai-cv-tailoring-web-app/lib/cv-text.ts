import { extractText, getDocumentProxy } from "unpdf";
import JSZip from "jszip";
import mammoth from "mammoth";
import { normalise, parseCv } from "./bullets";
import { DEFAULT_STYLE, parseFontName, type DocStyle } from "./export-style";

// CV parsing and cleaning. Everything happens in memory: nothing is written
// to disk and nothing is logged.

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_USEFUL_CHARS = 100; // below this a PDF is probably a scan

export class CvParseError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const PAGE_NUMBER = /^(?:[-–—]\s*)?(?:page\s*)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?(?:\s*[-–—])?$/i;

/** Normalise a line so repeated headers and footers match across pages. */
function fingerprint(line: string): string {
  return line.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * Remove lines that repeat at the top or bottom of most pages (headers and
 * footers). Only the first and last two lines of each page are considered,
 * so repeated real content in the body is never touched.
 */
function stripRepeatedHeadersFooters(pages: string[]): string[] {
  if (pages.length < 3) return pages;

  const split = pages.map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
  const counts = new Map<string, number>();
  for (const lines of split) {
    const edges = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(fingerprint));
    for (const f of edges) counts.set(f, (counts.get(f) ?? 0) + 1);
  }

  const threshold = Math.ceil(pages.length * 0.6);
  return split.map((lines) =>
    lines
      .filter((line, i) => {
        const isEdge = i < 2 || i >= lines.length - 2;
        const f = fingerprint(line);
        return !(isEdge && line.length < 80 && (counts.get(f) ?? 0) >= threshold);
      })
      .join("\n"),
  );
}

/** Collapse extra whitespace and blank lines, and drop obvious page numbers. */
export function cleanCvText(input: string): string {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t]/g, " ")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .filter((l) => !PAGE_NUMBER.test(l));

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLike(buffer: Buffer, kind: "pdf" | "docx"): boolean {
  if (kind === "pdf") return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  return buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" zip header
}

// ---------- PDF style detection (best effort, for the matched Word export) ----------

type PdfItem = { str: string; transform: number[]; width: number; fontName: string };
type PdfFontLike = { name?: string; loadedName?: string; bold?: boolean };
type PdfPageLike = {
  getViewport(o: { scale: number }): { width: number; height: number };
  getOperatorList(): Promise<unknown>;
  getTextContent(): Promise<{ items: PdfItem[]; styles: Record<string, { fontFamily?: string }> }>;
  commonObjs: { get(name: string): PdfFontLike | undefined };
};

const HIDDEN_FONT = /^g_d\d+_/; // pdf.js internal ids, not real font names
const SYMBOL_FONT = /symbol|wingding|dingbat|webding|bullet/i;

/**
 * The real font name is often hidden by the PDF reader for embedded fonts, but
 * the file itself usually lists it as "/BaseFont /ABCDEF+Calibri". Use the most
 * common such family (ignoring symbol fonts used for bullets).
 */
export function rawFontFamily(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes.subarray(0, 6 * 1024 * 1024)).toString("latin1");
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)) {
    const { family } = parseFontName(m[1]);
    if (!family || SYMBOL_FONT.test(family)) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
type PdfDocLike = { numPages: number; getPage(n: number): Promise<PdfPageLike> };

const round05 = (n: number) => Math.round(n * 2) / 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Most common value, weighted by weight. */
function mode<T>(entries: { value: T; weight: number }[]): T | undefined {
  const totals = new Map<T, number>();
  for (const e of entries) totals.set(e.value, (totals.get(e.value) ?? 0) + e.weight);
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Read the font family, sizes, heading weight, page size and margins from the
 * first two pages. Approximate: used only to make the exported Word file look
 * like the PDF. Returns null if nothing useful can be read.
 */
export async function detectPdfStyle(
  pdfDoc: unknown,
  cleanedText: string,
  rawBytes?: Uint8Array,
): Promise<DocStyle | null> {
  const rawFamily = rawBytes ? rawFontFamily(rawBytes) : null;
  const pdf = pdfDoc as PdfDocLike;
  type Seen = { text: string; size: number; family: string; bold: boolean; x: number; y: number; w: number; page: number };
  const seen: Seen[] = [];
  let page1: { width: number; height: number } | undefined;

  for (let n = 1; n <= Math.min(pdf.numPages, 2); n++) {
    const page = await pdf.getPage(n);
    if (n === 1) page1 = page.getViewport({ scale: 1 });
    try {
      await page.getOperatorList(); // loads the fonts so their real names are available
    } catch {
      /* fall back to the generic names below */
    }
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      let real = "";
      let fontBold = false;
      try {
        const f = page.commonObjs.get(it.fontName);
        const candidate = f?.name || f?.loadedName || "";
        real = HIDDEN_FONT.test(candidate) ? "" : candidate;
        fontBold = !!f?.bold;
      } catch {
        /* font not resolved */
      }
      const generic = parseFontName(content.styles[it.fontName]?.fontFamily || "");
      const named = real ? parseFontName(real) : null;
      // Real name from the reader, else the name listed in the file, else the generic family.
      const family = named?.family ?? rawFamily ?? generic.family;
      const bold = fontBold || (named?.bold ?? false);
      seen.push({
        text: it.str.trim(),
        size: round05(Math.hypot(it.transform[0], it.transform[1])),
        family,
        bold,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        page: n,
      });
    }
  }
  const usable = seen.filter((s) => s.size >= 5 && s.size <= 40);
  if (usable.length === 0 || !page1) return null;

  const chars = (s: Seen) => s.text.length;
  const bodySize = mode(usable.map((s) => ({ value: s.size, weight: chars(s) }))) ?? DEFAULT_STYLE.bodySize;
  const bodyItems = usable.filter((s) => s.size === bodySize);
  const fontFamily = mode(bodyItems.map((s) => ({ value: s.family, weight: chars(s) }))) ?? DEFAULT_STYLE.fontFamily;

  // Headings and the name line are found by matching their text to the parsed CV.
  const lines = parseCv(cleanedText);
  const headingKeys = new Set(lines.flatMap((l) => (l.kind === "heading" ? [normalise(l.text)] : [])));
  const heading = usable.filter((s) => headingKeys.has(normalise(s.text)));
  const firstLine = lines.find((l) => l.kind !== "blank");
  const firstKey = firstLine ? normalise(firstLine.kind === "bullet" || firstLine.kind === "heading" ? firstLine.text : firstLine.raw) : "";
  const name = usable.filter((s) => firstKey && normalise(s.text) !== "" && firstKey.startsWith(normalise(s.text)));

  const boldShare = (xs: Seen[]) => xs.filter((s) => s.bold).length > xs.length / 2;
  const headingSize = heading.length ? (mode(heading.map((s) => ({ value: s.size, weight: 1 }))) ?? bodySize) : bodySize + 1;
  const nameSize = name.length ? (mode(name.map((s) => ({ value: s.size, weight: 1 }))) ?? bodySize + 3) : bodySize + 3;

  // Margins from where the text sits on the first page.
  const p1 = usable.filter((s) => s.page === 1);
  const MIN = 24;
  const MAX = 110;
  // Only the left and top edges can be read reliably (short lines and short pages
  // say nothing about the right and bottom), so those mirror them.
  const left = clamp(Math.min(...p1.map((s) => s.x)), MIN, MAX);
  const top = clamp(page1.height - Math.max(...p1.map((s) => s.y + s.size)), MIN, MAX);
  const margins = { left, right: left, top, bottom: top };

  return {
    fontFamily,
    bodySize: clamp(bodySize, 7, 16),
    headingSize: clamp(headingSize, 7, 24),
    headingBold: heading.length ? boldShare(heading) : true,
    nameSize: clamp(nameSize, 7, 36),
    nameBold: name.length ? boldShare(name) : true,
    page: { width: page1.width, height: page1.height },
    margins,
  };
}

const SCANNED_MESSAGE =
  "I couldn't find much text in that file. It may be a scanned PDF. Please paste the text instead.";

export type ParsedCv = {
  text: string;
  /** PDFs only: the look of the original, for a matched Word export. Null if it couldn't be read. */
  style: DocStyle | null;
};

/**
 * Word reads a line break inside a paragraph (Shift+Enter) as a break, but mammoth's plain text drops it, which glues
 * the words on either side together ("MapomaPerformance"). The in-place export already treats such a break as a space,
 * so the text is read the same way here. Page breaks are left alone. Falls back to the original file if it can't be patched.
 */
async function withLineBreaksAsSpaces(buffer: Buffer): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file("word/document.xml");
    if (!file) return buffer;
    const xml = await file.async("string");
    const patched = xml.replace(/<w:br\s*\/>/g, '<w:t xml:space="preserve"> </w:t>').replace(/<w:br\s+w:type="textWrapping"\s*\/>/g, '<w:t xml:space="preserve"> </w:t>');
    if (patched === xml) return buffer;
    zip.file("word/document.xml", patched);
    return await zip.generateAsync({ type: "nodebuffer" });
  } catch {
    return buffer;
  }
}

export async function parseCvFile(buffer: Buffer, filename: string): Promise<string> {
  return (await parseCvFileWithStyle(buffer, filename)).text;
}

export async function parseCvFileWithStyle(buffer: Buffer, filename: string): Promise<ParsedCv> {
  if (buffer.length > MAX_CV_FILE_BYTES) {
    throw new CvParseError("That file is over 5MB. Please use a smaller file or paste the text.", 413);
  }

  const ext = filename.toLowerCase().split(".").pop();
  let text: string;
  let style: DocStyle | null = null;

  if (ext === "pdf") {
    if (!looksLike(buffer, "pdf")) {
      throw new CvParseError("That file doesn't look like a valid PDF.", 415);
    }
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: pages } = await extractText(pdf, { mergePages: false });
      text = cleanCvText(stripRepeatedHeadersFooters(pages.map((p) => p.trim())).join("\n\n"));
      try {
        style = await detectPdfStyle(pdf, text, new Uint8Array(buffer));
      } catch {
        style = null; // the text is still fine; the export falls back to the plain look
      }
    } catch {
      throw new CvParseError("I couldn't read that PDF. Please paste the text instead.", 422);
    }
  } else if (ext === "docx") {
    if (!looksLike(buffer, "docx")) {
      throw new CvParseError("That file doesn't look like a valid Word document.", 415);
    }
    try {
      const { value } = await mammoth.extractRawText({ buffer: await withLineBreaksAsSpaces(buffer) });
      text = cleanCvText(value);
    } catch {
      throw new CvParseError("I couldn't read that Word document. Please paste the text instead.", 422);
    }
  } else {
    throw new CvParseError("Only PDF and Word (.docx) files are supported. You can also paste the text.", 415);
  }

  if (text.length < MIN_USEFUL_CHARS) throw new CvParseError(SCANNED_MESSAGE, 422);
  return { text, style };
}
