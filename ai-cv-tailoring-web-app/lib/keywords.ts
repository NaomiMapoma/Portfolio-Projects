import { quoteInBullet, sectionKind, type Bullet } from "./bullets";
import type { z } from "zod";
import type { achievementsDraftSchema, keywordsDraftSchema, AnalysisCore } from "./types";

// Code-level checks on achievements and ATS keywords (PRD section 7). Pure
// functions: no tokens, no I/O.

type KeywordsDraft = z.infer<typeof keywordsDraftSchema>;
type AchievementsDraft = z.infer<typeof achievementsDraftSchema>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive match, so "Java" does not match "JavaScript". */
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

/** A rough word stem, so "reporting", "reported" and "reports" count as the same word. */
function stem(word: string): string {
  const w = word.toLowerCase();
  for (const suffix of ["ations", "ation", "ments", "ment", "ings", "ing", "ers", "er", "ed", "es", "s"]) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) return w.slice(0, -suffix.length);
  }
  return w;
}

/**
 * True if the text contains the term, allowing different word endings ("reporting" matches "Reported").
 * Used where being too strict would raise a false alarm.
 */
export function containsStem(text: string, term: string): boolean {
  const termStems = term.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.map(stem) ?? [];
  if (termStems.length === 0) return false;
  const textStems = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
  for (let i = 0; i + termStems.length <= textStems.length; i++) {
    if (termStems.every((t, k) => textStems[i + k] === t)) return true;
  }
  return false;
}

/** Where each whole-word match of `term` starts and ends in `text`. */
export function findTerm(text: string, term: string): { start: number; end: number }[] {
  const t = term.trim();
  if (!t) return [];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])`, "giu");
  return [...text.matchAll(re)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
}

/**
 * Gap keywords (terms the CV does not show) that a piece of model-written text
 * mentions. Used to stop strengths and achievements from claiming them.
 */
export function mentionsGapKeyword(text: string, gapKeywords: string[], cvText: string): string[] {
  return gapKeywords.filter((k) => k.trim().length >= 3 && containsTerm(text, k) && !containsTerm(cvText, k));
}

/**
 * A backstop that doesn't depend on the model's own gap list: tools, products,
 * qualifications and acronyms that the job description names but the CV never
 * does (for example Kubernetes, AWS, PRINCE2, Jira). It looks for words that
 * stand out as names: ALL CAPS, letters mixed with digits, an inner capital
 * (GitHub), symbols (Node.js, C++), or a capital that isn't at the start of a
 * sentence or line. A heuristic: line-start names in plain title case can be missed.
 */
export function jdOnlyTerms(jd: string, cv: string): string[] {
  const found = new Map<string, string>();
  // Role and job-title words are not tools or qualifications, and "Dear Hiring Manager" is normal wording.
  const TITLE_WORDS = /^(manager|engineer|developer|analyst|lead|senior|junior|director|head|officer|executive|assistant|consultant|specialist|coordinator|administrator|associate|principal|hiring|team|company|ltd|plc|inc)$/i;
  const word = /[A-Za-z][A-Za-z0-9]*(?:[.+#][A-Za-z0-9+#]*)*/g;

  for (const line of jd.split("\n")) {
    const tokens = [...line.matchAll(word)];
    // A short line of mostly capitalised words is a title ("Senior Programme Manager"), not a list of tools.
    const capitalised = tokens.filter((t) => /^[A-Z]/.test(t[0])).length;
    const titleLine = tokens.length > 0 && tokens.length <= 8 && capitalised / tokens.length >= 0.75 && !/[:,;]/.test(line);

    for (const m of tokens) {
      const w = m[0].replace(/[.]+$/, "");
      if (w.length < 2 || TITLE_WORDS.test(w)) continue;
      const before = line.slice(0, m.index).replace(/[ \t]+$/, "");
      const lastChar = before.slice(-1);
      const sentenceStart = before === "" || /[.!?]/.test(lastChar) || /^[-•*▪◦·]$/.test(lastChar);
      const hasDigit = /\d/.test(w) && /[A-Za-z]/.test(w);
      const allCaps = w === w.toUpperCase() && /[A-Z]{2}/.test(w);
      const innerCap = /[a-z][A-Z]/.test(w);
      const symbols = /[.+#]/.test(w) && /^[A-Za-z]/.test(w) && w.length > 2;
      const midCapital = /^[A-Z][a-z]/.test(w) && !sentenceStart && !titleLine;
      if (!(hasDigit || allCaps || innerCap || symbols || midCapital)) continue;
      if (containsTerm(cv, w)) continue;
      found.set(w.toLowerCase(), w);
    }
  }
  return [...found.values()];
}

/**
 * Is a keyword shown in the CV? Exact whole-word match, plus one safe relaxation: a single plain
 * lowercase word may match a different ending ("train" matches "Trained"). Names (Jira, PRINCE2,
 * AWS), anything with capitals, digits or symbols, and multi-word phrases stay exact.
 */
function shownInCv(cvText: string, keyword: string): boolean {
  if (containsTerm(cvText, keyword)) return true;
  const k = keyword.trim();
  return /^[a-z]{4,}$/.test(k) && containsStem(cvText, k);
}

export type KeywordResult = {
  keywords: AnalysisCore["keywords"];
  /** Keywords moved to "gaps" because the CV had no matching text or no real evidence quote. */
  demoted: number;
};

/**
 * Re-derive the three keyword groups from everything the model listed:
 *  - literally in the CV            -> present
 *  - not in the CV, real quote      -> addTruthfully (quote must be inside the cited bullet)
 *  - anything else                  -> gaps (only add if genuinely true)
 */
export function partitionKeywords(draft: KeywordsDraft, cvText: string, bullets: Bullet[]): KeywordResult {
  const seen = new Set<string>();
  const present: string[] = [];
  const addTruthfully: AnalysisCore["keywords"]["addTruthfully"] = [];
  const gaps: string[] = [];
  let demoted = 0;

  const key = (k: string) => k.trim().toLowerCase();
  const fresh = (k: string) => {
    const id = key(k);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  };

  // Keywords with evidence are handled first, so a real quote wins over a bare gap entry.
  for (const a of draft.addTruthfully) {
    if (!fresh(a.keyword)) continue;
    const keyword = a.keyword.trim();
    if (containsTerm(cvText, keyword)) present.push(keyword);
    else if (quoteInBullet(bullets, a.sourceBulletId, a.evidenceQuote)) addTruthfully.push({ ...a, keyword });
    else {
      gaps.push(keyword);
      demoted++;
    }
  }
  for (const k of draft.present) {
    if (!fresh(k)) continue;
    if (shownInCv(cvText, k)) present.push(k.trim());
    else {
      gaps.push(k.trim());
      demoted++;
    }
  }
  for (const k of draft.gaps) {
    if (!fresh(k)) continue;
    if (shownInCv(cvText, k)) present.push(k.trim());
    else gaps.push(k.trim());
  }

  return { keywords: { present, addTruthfully, gaps }, demoted };
}

/**
 * Skills to move to the front: kept only if the skill is written word for word in a skills section of the
 * CV, and it is not a gap. Order is kept, duplicates removed, at most 5.
 */
export function validateSkillsToFront(draft: string[] | undefined, bullets: Bullet[], gaps: string[]): string[] {
  const skillsText = bullets.filter((b) => sectionKind(b.section) === "skills").map((b) => b.text).join("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of draft ?? []) {
    const s = raw.trim();
    const id = s.toLowerCase();
    if (!s || seen.has(id) || !containsTerm(skillsText, s)) continue;
    if (gaps.some((g) => g.trim().toLowerCase() === id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out.slice(0, 5);
}

export type AchievementResult = {
  achievements: AnalysisCore["achievements"];
  dropped: number;
};

/** Drop emphasise items without a real quote (order kept, max 5); fill in quantify bullets from the CV. */
export function validateAchievements(draft: AchievementsDraft, bullets: Bullet[]): AchievementResult {
  const emphasise = draft.emphasise
    .filter((e) => quoteInBullet(bullets, e.sourceBulletId, e.evidenceQuote))
    .slice(0, 5);

  const seen = new Set<string>();
  const quantify: AnalysisCore["achievements"]["quantify"] = [];
  for (const q of draft.quantify) {
    const bullet = bullets.find((b) => b.id === q.sourceBulletId);
    if (!bullet || seen.has(bullet.id) || !q.metricToLookFor.trim()) continue;
    seen.add(bullet.id);
    quantify.push({ sourceBulletId: bullet.id, bullet: bullet.text, metricToLookFor: q.metricToLookFor.trim() });
  }

  const dropped = draft.emphasise.length - emphasise.length + (draft.quantify.length - quantify.length);
  return { achievements: { emphasise, quantify }, dropped };
}
