// Number checks used to stop invented figures. Pure functions, no tokens.
//
// Two ways of writing the same figure are the same number: "£5M+", "£5+ million", "5 million" and "£5,000,000"
// all mean 5000000, and "eight years" means 8. Different amounts (5M against 6M, or 50k against 5M) still differ.

const PLACEHOLDER = /\[[^\]]*\]/g;
const MAGNITUDE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

// A digit figure with an optional magnitude: attached "M" or "k" ("5M", "10k"), or a word ("5 million", "5+ million").
// The "+" is only emphasis and is ignored. A bare "m" with a space ("5 m") is not a magnitude.
const FIGURE = /\d[\d,]*(?:\.\d+)?(?:(?:\+?\s*(million|billion|thousand|mn|bn)\b)|([mkb])\b)?/gi;

// A CV that says "eight years" allows a rewrite to say "8 years": same number, different spelling.
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};
const WORD_NUMBER_RE = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b(?:\\s+(million|billion|thousand)\\b)?`, "gi");

type Figure = { start: number; end: number; value: string };

function canonical(n: number): string {
  return String(Number(n.toPrecision(12)));
}

/** Every figure in the text with its position and canonical value ("5M" and "5 million" both give "5000000"). */
function figures(text: string): Figure[] {
  const out: Figure[] = [];
  for (const m of text.matchAll(FIGURE)) {
    const digits = m[0].match(/^\d[\d,]*(?:\.\d+)?/)![0].replace(/,+$/, "");
    const n = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const mult = MAGNITUDE[(m[1] ?? m[2] ?? "").toLowerCase()] ?? 1;
    out.push({ start: m.index!, end: m.index! + m[0].length, value: canonical(n * mult) });
  }
  return out;
}

/** Number tokens in the text (canonical values), ignoring anything inside [placeholders] if asked. */
export function numberTokens(text: string, ignorePlaceholders: boolean): string[] {
  const source = ignorePlaceholders ? text.replace(PLACEHOLDER, " ") : text;
  return figures(source).map((f) => f.value);
}

function allowedNumbers(allowed: string): Set<string> {
  const ok = new Set(numberTokens(allowed, false));
  for (const m of allowed.matchAll(WORD_NUMBER_RE)) {
    ok.add(canonical(WORD_NUMBERS[m[1].toLowerCase()] * (MAGNITUDE[(m[2] ?? "").toLowerCase()] ?? 1)));
  }
  return ok;
}

/**
 * Numbers in `text` that are not in the allowed text. Digits inside
 * [placeholders] are allowed; anything else must already be in the allowed text.
 */
export function invalidNumbers(allowed: string, text: string): string[] {
  const ok = allowedNumbers(allowed);
  return [...new Set(numberTokens(text, true).filter((n) => !ok.has(n)))];
}
