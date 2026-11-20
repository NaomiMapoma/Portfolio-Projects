import { sectionKind, splitCv } from "./bullets";
import { containsTerm } from "./keywords";

// Adds verified keywords to the CV's own skills line and moves the skills that matter most to the front.
// Deterministic code, no model and no tokens. It only works on a short delimited list ("Excel, SQL, Power BI"),
// never removes or renames an item, and returns nothing when the line is not such a list, so it never guesses.

const LABEL = /^[A-Za-z][A-Za-z &/-]{0,30}:\s+/;
const DELIMITERS = [";", "|", "•", ","];

type Parsed = { label: string; items: string[]; sep: string; tail: string };

function parse(text: string): Parsed | null {
  const label = text.match(LABEL)?.[0] ?? "";
  let body = text.slice(label.length).trim();
  const tail = body.endsWith(".") ? "." : "";
  if (tail) body = body.slice(0, -1);
  const delim = DELIMITERS.find((d) => body.includes(d)) ?? ",";
  // Split only on delimiters outside brackets, so "SQL (MySQL, PostgreSQL)" stays one item.
  const items: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === delim && depth === 0) {
      items.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  items.push(cur.trim());
  const cleanItems = items.filter(Boolean);
  items.length = 0;
  items.push(...cleanItems);
  if (items.length < 2) return null;
  // A sentence is not a list, and splitting inside brackets would break an item such as "Excel (pivot, VLOOKUP)".
  const wordCounts = items.map((i) => i.split(/\s+/).length);
  if (wordCounts.some((n) => n > 6) || items.some((i) => i.length > 60)) return null;
  if (wordCounts.reduce((a, b) => a + b, 0) / items.length > 3.5) return null; // clauses, not skills
  if (items.some((i) => (i.match(/\(/g)?.length ?? 0) !== (i.match(/\)/g)?.length ?? 0))) return null;
  const sep = body.match(new RegExp(`\\s*${delim.replace(/[|.*+?^${}()[\]\\]/g, "\\$&")}\\s*`))?.[0] ?? ", ";
  return { label, items, sep, tail };
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The skills line with `add` keywords appended (unless already there) and `front` skills moved to the start, or
 * null if the line is not a delimited list. Every original item is kept, in its original wording.
 */
export function applySkills(text: string, add: string[], front: string[]): string | null {
  const p = parse(text);
  if (!p) return null;
  const frontKeys = front.map(norm);
  const moved = frontKeys.flatMap((k) => p.items.filter((i) => norm(i) === k)).filter((v, i, a) => a.indexOf(v) === i);
  const rest = p.items.filter((i) => !moved.includes(i));
  const upper = p.items.filter((i) => /^[A-Z]/.test(i)).length > p.items.length / 2;
  const added = add
    .map((k) => k.trim())
    .filter((k) => k && !containsTerm(text, k))
    .filter((k, i, a) => a.findIndex((x) => norm(x) === norm(k)) === i)
    .map((k) => (upper && /^[a-z]/.test(k) ? k[0].toUpperCase() + k.slice(1) : k));
  return p.label + [...moved, ...rest, ...added].join(p.sep) + p.tail;
}

export type SkillsPlan =
  | { status: "none" } // nothing to add or move
  | { status: "no-line" } // keywords were chosen but the CV has no skills list to put them in
  | { status: "ready"; id: string; before: string; after: string; added: string[] };

/** Finds the CV's skills line and works out the change. The first skills bullet that is a delimited list is used. */
export function planSkills(cv: string, add: string[], front: string[]): SkillsPlan {
  if (add.length === 0 && front.length === 0) return { status: "none" };
  for (const b of splitCv(cv).bullets) {
    if (sectionKind(b.section) !== "skills") continue;
    const after = applySkills(b.text, add, front);
    if (after === null) continue;
    if (after === b.text) return { status: "none" };
    return { status: "ready", id: b.id, before: b.text, after, added: add.filter((k) => !containsTerm(b.text, k)) };
  }
  return { status: "no-line" };
}

/**
 * Moves the chosen skills to the front on EVERY skills line that is a delimited list and holds at least one of them
 * (skills are often split across lines such as "Paid Media: ..." and "Reporting: ..."). Lines in `skip` are left out.
 */
export function planFrontMoves(cv: string, front: string[], skip: Set<string> = new Set()): { id: string; before: string; after: string }[] {
  if (front.length === 0) return [];
  const out: { id: string; before: string; after: string }[] = [];
  for (const b of splitCv(cv).bullets) {
    if (sectionKind(b.section) !== "skills" || skip.has(b.id)) continue;
    const after = applySkills(b.text, [], front);
    if (after !== null && after !== b.text) out.push({ id: b.id, before: b.text, after });
  }
  return out;
}
