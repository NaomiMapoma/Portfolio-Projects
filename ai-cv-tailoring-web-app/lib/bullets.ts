// Splits a CV into sections and numbered bullets (B1, B2...) so the model can
// cite them, and checks quotes against the CV. Pure functions, no I/O.

export type Bullet = { id: string; section: string; text: string };

const LIST_MARKER = /^\s*(?:[-–—•*▪◦·]|\d{1,2}[.)])\s+/;

function isHeading(line: string): boolean {
  if (LIST_MARKER.test(line)) return false;
  if (line.length > 40 || /[.;:!?]$/.test(line.replace(/:$/, "x"))) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length > 2 && letters === letters.toUpperCase();
  const known =
    /^(profile|summary|personal statement|experience|work experience|employment|employment history|education|skills|key skills|certifications|projects|achievements|interests|references|languages|training|qualifications|volunteering|publications)$/i;
  return allCaps || known.test(line.replace(/:$/, ""));
}

/** What kind of section a bullet sits in: the summary paragraph, a skills list, or anything else. */
export function sectionKind(section: string): "summary" | "skills" | "other" {
  const s = section.trim().toLowerCase();
  if (/(^|\b)(personal summary|professional summary|summary|profile|personal profile|professional profile|personal statement|career summary|about me)$/.test(s)) return "summary";
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
  return lines;
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
