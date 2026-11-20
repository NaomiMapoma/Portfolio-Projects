// Splits a CV into sections and numbered bullets (B1, B2...) so the model can
// cite them, and checks quotes against the CV. Pure functions, no I/O.

export type Bullet = { id: string; section: string; text: string };

const LIST_MARKER = /^\s*(?:[-–—•*▪◦·]|\d{1,2}[.)])\s+/;

// One list of summary section names, used both to spot the heading line and to classify the section,
// so the two can never disagree (a heading missed here meant the summary got no special handling).
const SUMMARY_NAMES =
  "personal summary|professional summary|executive summary|career summary|summary|profile|personal profile|professional profile|career profile|personal statement|professional statement|career objective|objective|professional overview|about me";

const KNOWN_HEADING = new RegExp(
  `^(${SUMMARY_NAMES}|experience|work experience|professional experience|employment|employment history|work history|education|skills|key skills|certifications|projects|achievements|interests|references|languages|training|qualifications|volunteering|publications)$`,
  "i",
);

function isHeading(line: string): boolean {
  if (LIST_MARKER.test(line)) return false;
  if (line.length > 40 || /[.;:!?]$/.test(line.replace(/:$/, "x"))) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length > 2 && letters === letters.toUpperCase();
  return allCaps || KNOWN_HEADING.test(line.replace(/:$/, ""));
}

/** What kind of section a bullet sits in: the summary paragraph, a skills list, or anything else. */
export function sectionKind(section: string): "summary" | "skills" | "other" {
  const s = section.trim().toLowerCase();
  if (new RegExp(`(^|\\b)(${SUMMARY_NAMES})$`).test(s)) return "summary";
  if (/\bskills?$|^(technologies|tools|technical proficiencies|core competenc(y|ies))$/.test(s)) return "skills";
  return "other";
}

/** One line of the CV, classified. `raw` is the line exactly as written. */
export type CvLine =
  | { kind: "blank"; raw: string }
  | { kind: "other"; raw: string }
  | { kind: "heading"; raw: string; text: string }
  | { kind: "bullet"; raw: string; id: string; section: string; text: string; marker: string };

/**
 * Classify every line of the CV. The single source of truth for bullet IDs:
 * the analysis prompt and the export both use it, so B3 always means the same line.
 */
export function parseCv(cv: string): CvLine[] {
  const lines: CvLine[] = [];
  let section = "Top";
  let count = 0;
  for (const raw of cv.split("\n")) {
    const line = raw.trim();
    if (!line) {
      lines.push({ kind: "blank", raw });
      continue;
    }
    if (isHeading(line)) {
      section = line.replace(/:$/, "");
      lines.push({ kind: "heading", raw, text: section });
      continue;
    }
    const marker = line.match(LIST_MARKER)?.[0].trim() ?? "";
    const text = line.replace(LIST_MARKER, "").trim();
    if (text) {
      count++;
      lines.push({ kind: "bullet", raw, id: `B${count}`, section, text, marker });
    } else {
      lines.push({ kind: "other", raw });
    }
  }
  markHeadinglessSummary(lines);
  return lines;
}

/**
 * Many CVs put the summary straight under the name with no heading. If no summary section was found, treat the
 * first long paragraph before any heading as the summary (relabel its section), so every part of the app handles
 * it as the summary. Contact lines and list items are never chosen.
 */
function markHeadinglessSummary(lines: CvLine[]): void {
  const bullets = lines.filter((l): l is Extract<CvLine, { kind: "bullet" }> => l.kind === "bullet");
  if (bullets.some((b) => sectionKind(b.section) === "summary")) return;
  for (const b of bullets) {
    if (b.section !== "Top") return; // past the first heading: not a headingless summary
    const words = b.text.split(/\s+/).length;
    if (b.marker === "" && words >= 25 && b.text.length >= 140 && !/@|https?:|www\./i.test(b.text)) {
      b.section = "Summary";
      // Later lines of the same paragraph block stay in "Top"; only the first long paragraph is the summary.
      return;
    }
  }
}

export function splitCv(cv: string): { bullets: Bullet[] } {
  const bullets: Bullet[] = [];
  for (const l of parseCv(cv)) {
    if (l.kind === "bullet") bullets.push({ id: l.id, section: l.section, text: l.text });
  }
  return { bullets };
}

/** Renders bullets for the prompt: "## Section" then "B3: text". */
export function formatForPrompt(bullets: Bullet[]): string {
  const out: string[] = [];
  let current = "";
  for (const b of bullets) {
    if (b.section !== current) {
      current = b.section;
      out.push(`\n## ${current}`);
    }
    out.push(`${b.id}: ${b.text}`);
  }
  return out.join("\n").trim();
}

/** Lower-case, drop quotes/markers, collapse whitespace so quotes match despite formatting. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[-–—•*▪◦·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if the quote appears in the text (formatting-tolerant). Empty quotes never match. */
export function quoteIn(text: string, quote: string): boolean {
  const q = normalise(quote);
  return q.length > 0 && normalise(text).includes(q);
}

/** True if the quote appears in the cited bullet (and therefore in the CV). */
export function quoteInBullet(bullets: Bullet[], bulletId: string, quote: string): boolean {
  const b = bullets.find((x) => x.id === bulletId);
  return !!b && quoteIn(b.text, quote);
}

/**
 * Bullet IDs (B4) are for the app's own checks and are never shown. If the model writes one anyway, "(B8)" is removed and
 * a bare "B7" or "B7 and B8" becomes "that line" or "those lines".
 */
export function stripBulletIds(text: string): string {
  const list = "B\\d+(?:\\s*(?:,|and|&)\\s*B\\d+)*";
  return text
    .replace(new RegExp(`\\s*\\(\\s*${list}\\s*\\)`, "g"), "")
    .replace(new RegExp(`\\b${list}\\b`, "g"), (m) => (/(,|and|&)/.test(m) ? "those lines" : "that line"));
}
