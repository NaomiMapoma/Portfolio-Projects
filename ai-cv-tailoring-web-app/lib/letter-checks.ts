import { containsStem, containsTerm, findTerm } from "./keywords";
import { styleNotes as styleNotesFor } from "./style-checks";
import { invalidNumbers } from "./numbers";

// Code-level checks on a generated cover letter. Pure functions: no tokens, no
// I/O. Facts (numbers, gap keywords, placeholders) make the letter amber;
// style problems are shown as quiet notes.

export const MIN_WORDS = 250;
export const MAX_WORDS = 300;

export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const PLACEHOLDER = /\[[^\]]*\]/g;

/** Whole-word, case-sensitive match. */
function findExact(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "u").test(text);
}

const BANNED_PHRASES = [
  "i am writing to apply",
  "i am writing to express",
  "i'm writing to apply",
  "i am excited to apply",
];

// Common US spellings that should be UK English in this app.
const US_SPELLINGS: [RegExp, string][] = [
  [/\borganiz(e|ed|es|ing|ation|ations)\b/i, "organise"],
  [/\boptimiz(e|ed|es|ing|ation)\b/i, "optimise"],
  [/\bprioritiz(e|ed|es|ing)\b/i, "prioritise"],
  [/\brecogniz(e|ed|es|ing)\b/i, "recognise"],
  [/\bcolor(s)?\b/i, "colour"],
  [/\bcenter(s|ed)?\b/i, "centre"],
  [/\bjudgment\b/i, "judgement"],
];

// A letter naturally echoes the job's wording about the employer ("your portfolio of ...", "the cross-functional
// delivery the role describes"). That is not a claim about the candidate.
const EMPLOYER_CONTEXT = /\b(your|the role|this role|the position|this position|the post|the job|the team)\b/i;

/** True if any mention of `term` is not about the employer or role (no such word within six words either side). */
function mentionedAsClaim(letter: string, term: string): boolean {
  return findTerm(letter, term).some(({ start, end }) => {
    const before = letter.slice(0, start).split(/\s+/).filter(Boolean).slice(-6).join(" ");
    const after = letter.slice(end).split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
    return !EMPLOYER_CONTEXT.test(`${before} ${after}`);
  });
}

export type LetterCheck = {
  wordCount: number;
  /** Facts that don't match the CV. Any of these makes the letter amber. */
  factIssues: string[];
  /** Style notes shown quietly (word count, clichés, spelling). */
  styleNotes: string[];
};

/**
 * @param letter the generated text
 * @param allowedText the CV text plus the user's accepted rewrites (the only source of numbers)
 * @param gapKeywords job description terms the CV does not show; the letter must not claim them
 * @param namedTerms tools, products and qualifications the CV never names (Jira, AWS, PRINCE2). These are
 *   flagged on any mention. Other gap keywords are flagged only when the mention isn't about the employer or role.
 */
export function checkLetter(letter: string, allowedText: string, gapKeywords: string[], namedTerms: string[] = []): LetterCheck {
  const factIssues: string[] = [];
  const styleNotes: string[] = [];

  const numbers = invalidNumbers(allowedText, letter);
  if (numbers.length > 0) {
    factIssues.push(`Contains ${numbers.length === 1 ? "a number" : "numbers"} that isn't in your CV: ${numbers.join(", ")}.`);
  }

  const placeholders = letter.match(PLACEHOLDER);
  if (placeholders) {
    factIssues.push(`Still contains ${placeholders.length === 1 ? "a placeholder" : "placeholders"}: ${placeholders.join(", ")}. Replace or remove.`);
  }

  const named = new Set(namedTerms.map((t) => t.trim().toLowerCase()));
  // A plain-looking name or acronym ("Editions", "ROLE") only counts when the letter writes it exactly like that, so an
  // ordinary lower-case word in a sentence ("the role", "editions") can never match it. Tools with digits or inner
  // capitals (PRINCE2, JavaScript) stay case-insensitive.
  const plainName = (k: string) => /^[A-Z][a-z]+$/.test(k.trim()) || /^[A-Z]{2,}$/.test(k.trim());
  const appears = (k: string) => (named.has(k.trim().toLowerCase()) && plainName(k) ? findExact(letter, k.trim()) : containsTerm(letter, k));
  const claimed = [...new Set([...gapKeywords, ...namedTerms])].filter((k) => {
    // The CV counts as showing a term even with a different ending ("reporting" vs "Reported").
    if (k.trim().length < 3 || !appears(k) || containsStem(allowedText, k)) return false;
    return named.has(k.trim().toLowerCase()) || mentionedAsClaim(letter, k);
  });
  if (claimed.length > 0) {
    factIssues.push(
      `Mentions ${claimed.map((k) => `"${k}"`).join(", ")}, which your CV doesn't show. Remove it unless it's genuinely true.`,
    );
  }

  const lower = letter.toLowerCase();
  for (const p of BANNED_PHRASES) {
    if (lower.includes(p)) styleNotes.push(`Uses the opener "${p}".`);
  }
  // Machine-sounding words, em dashes, repeated openers and stock phrases (words from the candidate's own CV are theirs).
  styleNotes.push(...styleNotesFor(letter, allowedText));
  for (const [re, uk] of US_SPELLINGS) {
    if (re.test(letter)) styleNotes.push(`US spelling found. Use UK English (${uk}).`);
  }

  const wordCount = countWords(letter);
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    styleNotes.push(`${wordCount} words. The aim is ${MIN_WORDS} to ${MAX_WORDS}.`);
  }

  return { wordCount, factIssues, styleNotes };
}
