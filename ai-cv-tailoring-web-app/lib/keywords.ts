// Term matching and the job-description name detector (PRD section 7). Pure functions: no tokens, no I/O.

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
/**
 * Words of the employer's name as the job description introduces it ("About Acme", "Join Acme Ltd", "Acme is a...").
 * Naming the employer is not a claim about the candidate, so these words are not "terms your CV doesn't show".
 * Only patterns that introduce the company are used, so tools and qualifications ("experience with Jira") never match.
 */
export function employerWords(jd: string): Set<string> {
  const NAME = "[A-Z][A-Za-z0-9&'’-]*(?:\\s+(?:&\\s+)?[A-Z][A-Za-z0-9&'’-]*){0,3}";
  const patterns = [
    new RegExp(`\\b(?:About|Join|Joining|Welcome to)\\s+(${NAME})`, "g"),
    new RegExp(`(?:^|[.!?]\\s+|\\n)(${NAME})\\s+(?:is|are|was|has|have|provides|offers|helps|works|operates|specialises|specializes)\\b`, "g"),
    new RegExp(`\\b(${NAME})\\s+(?:Ltd|Limited|plc|PLC|Inc|LLP|LLC|Group)\\b`, "g"),
    new RegExp(`\\b(${NAME})['’]s\\s+(?:team|mission|vision|clients|customers|values|culture|offices?)\\b`, "g"),
  ];
  const words = new Set<string>();
  for (const re of patterns) {
    for (const m of jd.matchAll(re)) {
      for (const w of m[1].split(/\s+/)) {
        const clean = w.replace(/['’]s$/, "").replace(/[^A-Za-z0-9&-]/g, "");
        if (clean.length >= 2 && clean !== "&") words.add(clean.toLowerCase());
      }
    }
  }
  return words;
}

export function jdOnlyTerms(jd: string, cv: string): string[] {
  const found = new Map<string, string>();
  // Role and job-title words are not tools or qualifications, and "Dear Hiring Manager" is normal wording.
  const TITLE_WORDS = /^(manager|engineer|developer|analyst|lead|senior|junior|director|head|officer|executive|assistant|consultant|specialist|coordinator|administrator|associate|principal|hiring|team|company|ltd|plc|inc)$/i;
  const word = /[A-Za-z][A-Za-z0-9]*(?:[.+#][A-Za-z0-9+#]*)*/g;
  // Ordinary words. An ALL-CAPS heading ("THE ROLE", "WHAT WE HAVE") or a capitalised heading word must never be
  // mistaken for a tool or a name, so a word that also appears in plain lower case in the text, or is a very
  // common English word, is skipped. Real tools (AWS, Jira, PRINCE2) are never written in plain lower case.
  const plainLower = new Set((jd.match(/\b[a-z]{2,}\b/g) ?? []));
  const COMMON =
    /^(the|this|that|these|those|what|which|who|how|why|when|where|have|has|had|will|would|can|could|should|must|may|role|roles|about|your|our|you|we|with|for|and|but|not|all|any|are|is|was|were|from|into|more|most|key|new|job|work|working|apply|benefits|requirements|responsibilities|skills|experience|summary|overview|description|location|salary|package|culture|values|mission|team|company)$/i;

  for (const line of jd.split("\n")) {
    const tokens = [...line.matchAll(word)];
    // An ALL-CAPS heading line has no lower-case letters: only tokens with a digit (PRINCE2, ISO27001) can be tools there.
    const capsHeading = /[A-Z]/.test(line) && !/[a-z]/.test(line);
    // A short line of mostly capitalised words is a title ("Senior Programme Manager"), not a list of tools.
    const capitalised = tokens.filter((t) => /^[A-Z]/.test(t[0])).length;
    const titleLine = tokens.length > 0 && tokens.length <= 8 && capitalised / tokens.length >= 0.75 && !/[:,;]/.test(line);

    for (const m of tokens) {
      const w = m[0].replace(/[.]+$/, "");
      if (w.length < 2 || TITLE_WORDS.test(w)) continue;
      const plainWord = !/\d/.test(w) && (COMMON.test(w) || plainLower.has(w.toLowerCase()));
      if (plainWord || (capsHeading && !/\d/.test(w))) continue;
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
