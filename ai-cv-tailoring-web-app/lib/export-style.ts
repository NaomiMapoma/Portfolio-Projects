// Visual style used to rebuild a CV as a Word file when the original can't be
// edited in place (PDF uploads). All sizes are in points. Client-safe, no I/O.

export type DocStyle = {
  fontFamily: string;
  bodySize: number;
  headingSize: number;
  headingBold: boolean;
  nameSize: number;
  nameBold: boolean;
  /** Page size in points, if detected. */
  page?: { width: number; height: number };
  /** Page margins in points, if detected. */
  margins?: { top: number; right: number; bottom: number; left: number };
};

/**
 * What we know about where the CV came from, held in the browser tab's memory
 * only. A Word upload keeps its file bytes so it can be edited in place; a PDF
 * keeps the detected look; pasted text has neither.
 */
export type CvSource =
  | { kind: "docx"; bytes: ArrayBuffer; name: string }
  | { kind: "pdf"; style: DocStyle | null; name: string }
  | null;

/** The plain, ATS-friendly look used when there is nothing to match. */
export const DEFAULT_STYLE: DocStyle = {
  fontFamily: "Arial",
  bodySize: 11,
  headingSize: 12,
  headingBold: true,
  nameSize: 14,
  nameBold: true,
};

const SUBSET_PREFIX = /^[A-Z]{6}\+/;
const MAPPED: Record<string, string> = {
  helvetica: "Arial",
  arialmt: "Arial",
  arial: "Arial",
  "times-roman": "Times New Roman",
  times: "Times New Roman",
  timesnewromanps: "Times New Roman",
  timesnewromanpsmt: "Times New Roman",
  timesnewroman: "Times New Roman",
  courier: "Courier New",
  couriernewpsmt: "Courier New",
  symbol: "Symbol",
  // Generic families (what a PDF reader reports when the real name is hidden).
  sans: "Arial",
  "sans-serif": "Arial",
  serif: "Times New Roman",
  monospace: "Courier New",
};

/** Turns a PDF font name such as "ABCDEF+Calibri-Bold" into { family: "Calibri", bold: true }. */
export function parseFontName(raw: string): { family: string; bold: boolean } {
  let name = raw.replace(SUBSET_PREFIX, "").trim();
  const bold = /bold|black|heavy|semibold|demi/i.test(name);
  // Drop style suffixes: "-Bold", ",Bold", "-BoldMT", "-Italic", "PSMT"...
  name = name
    .split(/[-,]/)[0]
    .replace(/(PS)?MT$/, "")
    .replace(/(Bold|Italic|Oblique|Regular)+$/i, "");
  const key = name.toLowerCase().replace(/\s+/g, "");
  if (MAPPED[key]) return { family: MAPPED[key], bold };
  // "OpenSans" -> "Open Sans"
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return { family: spaced || DEFAULT_STYLE.fontFamily, bold };
}
