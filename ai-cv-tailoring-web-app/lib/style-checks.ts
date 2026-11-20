import { AI_TELLS } from "./style";

// Cheap, token-free style checks. They flag; they never rewrite or retry. Pure functions, no I/O.

const MAX_SENTENCE_WORDS = 38;

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9£'’-]+/g) ?? [];

/**
 * Notes about machine-sounding writing in `text`. `source` is what the candidate wrote themselves (their CV): a
 * word that is already in the source is theirs, so it is not flagged.
 */
export function styleNotes(text: string, source = ""): string[] {
  const notes: string[] = [];

  for (const t of AI_TELLS) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${t.re}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(text) && !re.test(source)) notes.push(`Uses "${t.label}".`);
  }

  if (/—/.test(text) && !/—/.test(source)) notes.push("Uses an em dash. A full stop or comma sounds more natural.");

  const sentences = sentencesOf(text);
  const longOnes = sentences.filter((s) => wordsOf(s).length > MAX_SENTENCE_WORDS).length;
  if (longOnes > 0) notes.push(`${longOnes === 1 ? "A sentence is" : `${longOnes} sentences are`} very long. Consider splitting.`);

  // The same two opening words on three or more sentences reads as a template.
  const openers = new Map<string, number>();
  for (const s of sentences) {
    const w = wordsOf(s).slice(0, 2).join(" ");
    if (w.split(" ").length === 2) openers.set(w, (openers.get(w) ?? 0) + 1);
  }
  for (const [opener, n] of openers) {
    if (n >= 3) notes.push(`${n} sentences start with "${opener}". Vary the openings.`);
  }

  // A phrase of five or more words used twice is usually a stock formula ("the kind of work your role needs").
  const words = wordsOf(text);
  const seen = new Map<string, number>();
  const repeated = new Set<string>();
  for (let i = 0; i + 5 <= words.length; i++) {
    const g = words.slice(i, i + 5).join(" ");
    seen.set(g, (seen.get(g) ?? 0) + 1);
    if ((seen.get(g) ?? 0) === 2) repeated.add(g);
  }
  // Report one example only, so a long repeat does not produce a pile of overlapping notes.
  const first = [...repeated][0];
  if (first) notes.push(`Repeats the phrase "${first}". Say it a different way the second time.`);

  return notes;
}
