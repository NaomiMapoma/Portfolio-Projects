import JSZip from "jszip";
import { normalise } from "./bullets";
import type { Change } from "./export";

// Edits an uploaded Word file IN PLACE so everything the author designed (fonts,
// sizes, colours, tables, margins, headers, styles) is kept. Only the text of
// the accepted bullets changes. Runs in the browser from the file bytes held in
// the tab's memory: nothing is sent anywhere and nothing is stored.

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MARKER = /^\s*(?:[-–—•*▪◦·]|\d{1,2}[.)])\s+/;

/** Minimal DOM helpers, so the same code runs in the browser and (via jsdom) in tests. */
export type DomApi = {
  parse(xml: string): Document;
  serialize(doc: Document): string;
};

export function browserDom(): DomApi {
  return {
    parse(xml) {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("document.xml is not valid XML");
      return doc;
    },
    serialize: (doc) => new XMLSerializer().serializeToString(doc),
  };
}

export type InPlaceResult = {
  data: Uint8Array;
  /** Bullet IDs that were changed in the file. */
  applied: string[];
  /** Bullets left as in the original, with the reason. */
  unmatched: { id: string; reason: string }[];
};

type Para = { el: Element; text: string };

const nearestParagraph = (node: Node | null): Element | null => {
  for (let n = node?.parentNode ?? null; n; n = n.parentNode) {
    if (n.nodeType === 1 && (n as Element).localName === "p" && (n as Element).namespaceURI === W_NS) return n as Element;
  }
  return null;
};

/** The paragraph's own text (not text from paragraphs nested in text boxes). */
function paragraphText(p: Element): string {
  let out = "";
  const walk = (node: Node) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const el = c as Element;
      if (el.namespaceURI === W_NS && el.localName === "p") continue; // nested paragraph: handled on its own
      if (el.namespaceURI === W_NS && el.localName === "t") out += el.textContent ?? "";
      else if (el.namespaceURI === W_NS && el.localName === "tab") out += " ";
      else if (el.namespaceURI === W_NS && (el.localName === "br" || el.localName === "cr")) out += " ";
      else walk(el);
    }
  };
  walk(p);
  return out;
}

const textRuns = (p: Element): Element[] =>
  Array.from(p.getElementsByTagNameNS(W_NS, "r")).filter(
    (r) => nearestParagraph(r) === p && Array.from(r.childNodes).some((c) => c.nodeType === 1 && (c as Element).localName === "t"),
  );

const runLength = (r: Element) =>
  Array.from(r.childNodes)
    .filter((c) => c.nodeType === 1 && (c as Element).localName === "t")
    .reduce((n, c) => n + (c.textContent?.length ?? 0), 0);

function setRunText(doc: Document, run: Element, text: string) {
  const ts = Array.from(run.childNodes).filter((c) => c.nodeType === 1 && (c as Element).localName === "t") as Element[];
  const [first, ...rest] = ts;
  rest.forEach((t) => t.remove());
  first.textContent = text;
  first.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  void doc;
}

function clearRunText(run: Element) {
  Array.from(run.childNodes).forEach((c) => {
    if (c.nodeType === 1 && ["t", "tab", "br", "cr"].includes((c as Element).localName)) run.removeChild(c);
  });
}

/**
 * Apply accepted changes to the original .docx bytes. A bullet that can't be
 * located safely is left exactly as it was and reported in `unmatched`.
 */
export async function editDocxInPlace(
  bytes: ArrayBuffer | Uint8Array,
  changes: Change[],
  dom: DomApi = browserDom(),
): Promise<InPlaceResult> {
  // createFolders: false keeps the package's part list exactly as the author's file had it.
  const zip = await JSZip.loadAsync(bytes, { createFolders: false });
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("That file doesn't look like a Word document.");

  const xml = await file.async("string");
  const declaration = xml.match(/^\s*<\?xml[^>]*\?>\s*/)?.[0] ?? "";
  const doc = dom.parse(xml);

  // Every paragraph in document order, including those in tables and text boxes.
  const paras: Para[] = Array.from(doc.getElementsByTagNameNS(W_NS, "p")).map((el) => ({
    el,
    text: paragraphText(el),
  }));
  const keyOf = (t: string) => normalise(t.replace(MARKER, ""));
  const byKey = new Map<string, Para[]>();
  for (const p of paras) {
    const k = keyOf(p.text);
    if (!k) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }

  const applied: string[] = [];
  const unmatched: InPlaceResult["unmatched"] = [];

  for (const c of changes) {
    const candidates = byKey.get(keyOf(c.before)) ?? [];
    const para = candidates[c.occurrence];
    if (!para) {
      unmatched.push({ id: c.id, reason: "I couldn't find this bullet in your original file (the text may have been edited)." });
      continue;
    }
    if (para.el.getElementsByTagNameNS(W_NS, "fldChar").length > 0) {
      unmatched.push({ id: c.id, reason: "This bullet contains a field or link code, so I left it unchanged." });
      continue;
    }
    // A cut removes the whole paragraph. If Word needs the paragraph to stay (the only one in a table cell, or it
    // carries section settings), its text is cleared instead.
    if (c.remove) {
      const parent = para.el.parentNode;
      const onlyInCell = !!parent && (parent as Element).localName === "tc" && (parent as Element).getElementsByTagNameNS(W_NS, "p").length === 1;
      const hasSection = para.el.getElementsByTagNameNS(W_NS, "sectPr").length > 0;
      if (!parent) {
        unmatched.push({ id: c.id, reason: "I couldn't remove this line safely, so I left it in." });
        continue;
      }
      if (onlyInCell || hasSection) textRuns(para.el).forEach(clearRunText);
      else parent.removeChild(para.el);
      applied.push(c.id);
      continue;
    }
    const runs = textRuns(para.el);
    if (runs.length === 0) {
      unmatched.push({ id: c.id, reason: "I couldn't find editable text for this bullet." });
      continue;
    }

    // Keep a typed list marker (for example "• ") if the original paragraph had one.
    const prefix = para.text.match(MARKER)?.[0].replace(/^\s+/, "") ?? "";
    // The longest run carries the new text, so it keeps that run's font, size, bold and colour.
    const dominant = runs.reduce((a, b) => (runLength(b) > runLength(a) ? b : a));
    runs.forEach((r) => {
      if (r !== dominant) clearRunText(r);
    });
    setRunText(doc, dominant, `${prefix}${c.after}`);
    applied.push(c.id);
  }

  if (applied.length > 0) {
    let out = dom.serialize(doc);
    if (declaration && !/^\s*<\?xml/.test(out)) out = declaration + out;
    zip.file("word/document.xml", out, { createFolders: false });
  }
  const data = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return { data, applied, unmatched };
}
