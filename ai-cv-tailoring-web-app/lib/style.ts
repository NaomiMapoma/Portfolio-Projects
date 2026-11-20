// One place for the writing-style rules, shared by every prompt that produces text the user will read or send.
// Pure data and strings: no I/O. The checks in style-checks.ts use the same word list.

/** Words and phrases that make writing sound machine-made. Each is a regex source matched as a whole word. */
export const AI_TELLS: { re: string; label: string }[] = [
  { re: "passionate", label: "passionate" },
  { re: "dynamic", label: "dynamic" },
  { re: "results[- ]driven", label: "results-driven" },
  { re: "go-getter", label: "go-getter" },
  { re: "synergy", label: "synergy" },
  { re: "rockstar", label: "rockstar" },
  { re: "leverag(?:e|ed|es|ing)", label: "leverage" },
  { re: "spearhead(?:ed|s|ing)?", label: "spearhead" },
  { re: "delv(?:e|ed|es|ing)", label: "delve" },
  { re: "robust", label: "robust" },
  { re: "seamless(?:ly)?", label: "seamless" },
  { re: "cutting[- ]edge", label: "cutting-edge" },
  { re: "tapestry", label: "tapestry" },
  { re: "testament", label: "testament" },
  { re: "pivotal", label: "pivotal" },
  { re: "game[- ]chang(?:er|ing)", label: "game-changing" },
  { re: "holistic", label: "holistic" },
  { re: "utili[sz](?:e|ed|es|ing)", label: "utilise" },
  { re: "proven track record", label: "proven track record" },
  { re: "fast[- ]paced", label: "fast-paced" },
  { re: "strong foundation", label: "strong foundation" },
  { re: "deep understanding", label: "deep understanding" },
  { re: "in today's", label: "in today's" },
  { re: "world[- ]class", label: "world-class" },
  { re: "best[- ]in[- ]class", label: "best-in-class" },
  // Template or meta phrases that appeared in generated letters: what the experience "gave" the candidate, or the
  // letter talking about its own rules.
  { re: "(?:gave|taught|showed) me", label: "gave me" },
  { re: "grounding in", label: "grounding in" },
  { re: "familiar ground", label: "familiar ground" },
  { re: "set out only", label: "set out only" },
  { re: "my cv (?:shows|states|lists|says)", label: "my CV shows" },
];

/**
 * Prompt block shared by the analysis and the cover letter. It governs HOW things are written. It never loosens the
 * fact rules: those are stated separately and always win.
 */
export const STYLE_RULES = `Writing style (applies to everything you write for the candidate to read or send):
- Write like a careful person, not a template. Plain words, specific nouns, and a mix of short and longer sentences.
- Use the candidate's own verbs and phrasing. Do not upgrade their vocabulary: "did" must not become "orchestrated", "helped" must not become "empowered".
- Avoid these machine-sounding words and phrases: leverage, spearhead, delve, robust, seamless, cutting-edge, tapestry, testament, pivotal, holistic, game-changing, world-class, utilise (say "use"), "proven track record", "fast-paced", "strong foundation", "deep understanding", "in today's", passionate, dynamic, results-driven, synergy.
- No em dashes. Use a full stop or a comma instead.
- Never describe what an experience "gave" or "taught" the candidate, and never mention that the text is based on the CV or follows rules (no "I have set out only what my CV shows").
- No rhetorical openers, no "not just X but Y", no lists of three added for rhythm, no filler transitions ("Moreover", "Furthermore", "In conclusion").
- Do not start several sentences in the same way, and do not repeat the same phrase to link experience to the role. State relevance in different, natural ways, or fold it into the sentence about what the candidate did.
- Writing style never permits adding a fact, trait, feeling or result. The truthfulness rules always win.`;
