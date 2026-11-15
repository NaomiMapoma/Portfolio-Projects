// Number checks used to stop invented figures. Pure functions, no tokens.

const PLACEHOLDER = /\[[^\]]*\]/g;
const NUMBER = /\d[\d,.]*/g;

/** Number tokens in the text, ignoring anything inside [placeholders]. Commas are dropped: 1,000 = 1000. */
export function numberTokens(text: string, ignorePlaceholders: boolean): string[] {
  const source = ignorePlaceholders ? text.replace(PLACEHOLDER, " ") : text;
  return (source.match(NUMBER) ?? [])
    .map((t) => t.replace(/[.,]+$/, "").replace(/,/g, ""))
    .filter(Boolean);
}

/**
 * Numbers in `text` that are not in the allowed text. Digits inside
 * [placeholders] are allowed; anything else must already be in the allowed text.
 */
export function invalidNumbers(allowed: string, text: string): string[] {
  const ok = new Set(numberTokens(allowed, false));
  return [...new Set(numberTokens(text, true).filter((n) => !ok.has(n)))];
}
