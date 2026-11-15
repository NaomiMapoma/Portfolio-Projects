import { normalise, parseCv } from "./bullets";

// Builds the tailored CV from the original CV text plus the rewrites the user
// accepted. Pure and client-safe: no network, no storage, no AI. Everything the
// user did not accept stays exactly as written.

export type AcceptedRewrite = { id: string; text: string };

export type ExportLine =
  | { kind: "blank"; text: "" }
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string } // a list item (the original had a bullet marker)
  | { kind: "paragraph"; text: string };

export type Change = {
  id: string;
  before: string;
  after: string;
  /** 0-based position of this bullet among CV bullets with identical text (for matching in the original file). */
  occurrence: number;
};

export type ExportResult = {
  lines: ExportLine[];
  /** The tailored CV as plain text, keeping the original line structure. */
  plainText: string;
  changes: Change[];
  /** Accepted rewrites that were left out (empty, unchanged, or an unknown bullet), with the reason. */
  skipped: { id: string; reason: string }[];
  /** Applied rewrites that still contain a [placeholder]. */
  withPlaceholders: string[];
};

const PLACEHOLDER = /\[[^\]]*\]/;

export function buildExport(cv: string, accepted: AcceptedRewrite[]): ExportResult {
  const parsed = parseCv(cv);
  const wanted = new Map(accepted.map((a) => [a.id, a.text.trim()]));
  const known = new Set(parsed.flatMap((l) => (l.kind === "bullet" ? [l.id] : [])));

  const lines: ExportLine[] = [];
  const plain: string[] = [];
  const changes: Change[] = [];
  const skipped: ExportResult["skipped"] = [];
  const withPlaceholders: string[] = [];

  for (const [id, text] of wanted) {
    if (!known.has(id)) skipped.push({ id, reason: "That bullet is not in your CV." });
    else if (!text) skipped.push({ id, reason: "The rewrite is empty, so the original was kept." });
  }

  const seenText = new Map<string, number>();

  for (const l of parsed) {
    if (l.kind === "blank") {
      lines.push({ kind: "blank", text: "" });
      plain.push(l.raw);
    } else if (l.kind === "heading") {
      lines.push({ kind: "heading", text: l.text });
      plain.push(l.raw);
    } else if (l.kind === "other") {
      lines.push({ kind: "paragraph", text: l.raw.trim() });
      plain.push(l.raw);
    } else {
      const key = normalise(l.text);
      const occurrence = seenText.get(key) ?? 0;
      seenText.set(key, occurrence + 1);
      const replacement = wanted.get(l.id);
      const apply = replacement !== undefined && replacement !== "" && replacement !== l.text;
      if (replacement !== undefined && replacement === l.text) {
        skipped.push({ id: l.id, reason: "The rewrite is the same as the original." });
      }
      const text = apply ? replacement : l.text;
      lines.push({ kind: l.marker ? "bullet" : "paragraph", text });
      // Unchanged lines keep their raw text exactly. Changed lines keep their original marker.
      plain.push(apply ? `${l.marker ? `${l.marker} ` : ""}${text}` : l.raw);
      if (apply) {
        changes.push({ id: l.id, before: l.text, after: text, occurrence });
        if (PLACEHOLDER.test(text)) withPlaceholders.push(l.id);
      }
    }
  }

  return { lines, plainText: plain.join("\n"), changes, skipped, withPlaceholders };
}
