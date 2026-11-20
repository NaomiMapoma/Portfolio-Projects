import { parseCv, sectionKind } from "./bullets";
import type { DraftMove, DraftRejection } from "./draft-types";

// Reordering the bullets inside one role. Pure functions, no tokens. A move is checked in code and then applied as a
// text swap between positions, so the Word, PDF-matched and plain exports need no new machinery.

const DATE_LINE = /\b(19|20)\d{2}\b|\b(present|current)\b/i;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** A job line such as "Programme Manager, Example Council, 2019 to 2024": short, dated, and not a list item. */
export function looksLikeRoleLine(text: string, marker: string): boolean {
  return !marker && words(text) <= 20 && DATE_LINE.test(text);
}

export type Run = {
  /** The first bullet ID of the run, used as its key. */
  key: string;
  /** The run's bullet IDs, in CV order. */
  ids: string[];
  /** The role line above the run (its text), or "" if there is none. */
  label: string;
};

type Parsed = ReturnType<typeof parseCv>;

const isCandidate = (l: Parsed[number]): l is Extract<Parsed[number], { kind: "bullet" }> =>
  l.kind === "bullet" && sectionKind(l.section) === "other" && l.section !== "Top" && !looksLikeRoleLine(l.text, l.marker);

/**
 * Word uploads are read with a blank line between EVERY paragraph, so a blank line says nothing there. In pasted text a
 * blank line usually separates roles. Blank lines are noise when more than half of the neighbouring bullets have one
 * between them.
 */
function blanksAreNoise(lines: Parsed): boolean {
  let pairs = 0;
  let withBlank = 0;
  let prev = -1;
  let blank = false;
  lines.forEach((l, i) => {
    if (l.kind === "blank") {
      blank = true;
      return;
    }
    if (isCandidate(l)) {
      if (prev >= 0) {
        pairs++;
        if (blank) withBlank++;
      }
      prev = i;
    } else prev = -1;
    blank = false;
  });
  return pairs > 0 && withBlank / pairs > 0.5;
}

/**
 * The runs of bullets that may be reordered: consecutive lines in one ordinary section, at least two long, bounded by
 * headings, dated role lines and (when they mean something) blank lines. It does NOT depend on list markers, because a
 * Word upload is read without them. The summary, skills lines and the lines under the name are never part of a run.
 */
export function findRuns(cv: string): Run[] {
  const lines = parseCv(cv);
  const noise = blanksAreNoise(lines);
  const runs: Run[] = [];
  let ids: string[] = [];
  let section = "";
  let label = "";
  const flush = () => {
    if (ids.length >= 2) runs.push({ key: ids[0], ids, label });
    ids = [];
  };
  for (const l of lines) {
    if (l.kind === "blank") {
      if (!noise) flush();
      continue;
    }
    if (l.kind !== "bullet") {
      flush();
      continue;
    }
    if (sectionKind(l.section) !== "other" || l.section === "Top") {
      flush();
      continue;
    }
    if (looksLikeRoleLine(l.text, l.marker)) {
      flush();
      label = l.text;
      section = l.section;
      continue;
    }
    if (l.section !== section) {
      flush();
      section = l.section;
      label = "";
    }
    ids.push(l.id);
  }
  flush();
  return runs;
}

/** Entries look like "B6,B4,B5" or "B6,B4,B5|Leads with delivery": all the IDs of one role in the new order, then an optional reason. */
function parseGroup(entry: string): { ids: string[]; reason: string } {
  const [list, ...rest] = entry.split("|");
  return { ids: list.split(",").map((s) => s.trim()).filter(Boolean), reason: rest.join("|").trim().slice(0, 160) };
}

/**
 * Check the model's reorder entries. A group is kept only if it is exactly a permutation of one run, differs from the
 * current order, and contains no cut line. Anything else is dropped with a plain reason. `keep` holds the keys of runs
 * the user has put back to the original order, which are never reordered again.
 */
export function planMoves(cv: string, groups: string[], cutIds: Set<string>, keep: Set<string> = new Set()): { moves: DraftMove[]; rejections: DraftRejection[] } {
  const runs = findRuns(cv);
  const moves: DraftMove[] = [];
  const rejections: DraftRejection[] = [];
  const used = new Set<string>();
  for (const entry of groups) {
    const { ids, reason } = parseGroup(entry);
    if (ids.length < 2) continue;
    const run = runs.find((r) => r.ids.includes(ids[0]));
    const label = run?.label ? `The order under ${run.label}` : "A reorder";
    if (!run) {
      rejections.push({ label: "A reorder", reason: "it named lines that aren't a list of bullets in your CV." });
      continue;
    }
    if (keep.has(run.key) || used.has(run.key)) continue;
    const sameSet = ids.length === run.ids.length && new Set(ids).size === ids.length && ids.every((id) => run.ids.includes(id));
    if (!sameSet) {
      rejections.push({ label, reason: "it left out, repeated or mixed in lines from another role." });
      continue;
    }
    if (ids.join() === run.ids.join()) continue; // already in that order
    if (run.ids.some((id) => cutIds.has(id))) {
      rejections.push({ label, reason: "one of those lines is also being cut." });
      continue;
    }
    used.add(run.key);
    moves.push({ key: run.key, ids, original: run.ids, label: run.label, whatChanged: reason || "Puts the lines that matter most for this role first." });
  }
  return { moves, rejections };
}
