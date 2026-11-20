// Word-level difference between two lines, worked out in the browser. Pure: nothing is stored or sent anywhere.

export type DiffPart = {
  text: string;
  kind: "same" | "added" | "removed" | "moved";
  /** Punctuation after a kept word that was added or removed (for example the comma in "TikTok,"). Only this is marked. */
  mark?: string;
};

// A word counts as kept when only its punctuation or capitals differ, so "TikTok", "TikTok," and "tiktok" are the same word.
// Curly and straight quotes and the different dashes are the same character for this purpose.
const plain = (w: string) => w.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-");
const core = (w: string) => plain(rawCore(w)).toLowerCase();
const rawCore = (w: string) => w.replace(/^[^\p{L}\p{N}£$€%&+]+|[^\p{L}\p{N}£$€%&+]+$/gu, "") || w;
const trail = (w: string) => w.slice(rawCore(w) === w ? w.length : w.lastIndexOf(rawCore(w)) + rawCore(w).length);

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** The original with removed words marked, and the new line with added words marked (longest common subsequence of words). */
export function wordDiff(before: string, after: string): { original: DiffPart[]; next: DiffPart[] } {
  const a = words(before);
  const b = words(after);
  // Lines are short (a CV bullet or summary), so the plain table is fine.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = core(a[i]) === core(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const original: DiffPart[] = [];
  const next: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (core(a[i]) === core(b[j])) {
      if (a[i] === b[j]) {
        original.push({ text: a[i], kind: "same" });
        next.push({ text: b[j], kind: "same" });
      } else {
        // Same word, different punctuation: the word is not marked, only the punctuation that changed.
        const ta = trail(a[i]);
        const tb = trail(b[j]);
        const la = a[i].slice(0, a[i].length - ta.length);
        const lb = b[j].slice(0, b[j].length - tb.length);
        original.push({ text: la, kind: "same", mark: ta !== tb ? ta : undefined });
        next.push({ text: lb, kind: "same", mark: ta !== tb ? tb : undefined });
        if (ta === tb) {
          original[original.length - 1].text = a[i];
          next[next.length - 1].text = b[j];
        }
      }
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      original.push({ text: a[i++], kind: "removed" });
    } else {
      next.push({ text: b[j++], kind: "added" });
    }
  }
  while (i < a.length) original.push({ text: a[i++], kind: "removed" });
  while (j < b.length) next.push({ text: b[j++], kind: "added" });
  // A word that was taken out of one place and put in another is "moved", not removed: it is still in the new line.
  const available = new Map<string, number>();
  for (const p of next) if (p.kind === "added") available.set(core(p.text), (available.get(core(p.text)) ?? 0) + 1);
  const movedOut = new Map<string, number>();
  for (const p of original) {
    if (p.kind !== "removed") continue;
    const k = core(p.text);
    if ((available.get(k) ?? 0) > 0) {
      available.set(k, (available.get(k) ?? 0) - 1);
      movedOut.set(k, (movedOut.get(k) ?? 0) + 1);
      p.kind = "moved";
    }
  }
  for (const p of next) {
    if (p.kind !== "added") continue;
    const k = core(p.text);
    if ((movedOut.get(k) ?? 0) > 0) {
      movedOut.set(k, (movedOut.get(k) ?? 0) - 1);
      p.kind = "moved";
    }
  }
  return { original, next };
}
