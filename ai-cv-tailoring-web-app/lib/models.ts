// Model names are read from the environment (.env.local) so they can be changed
// without touching code. The defaults are only used when a variable is unset.

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const DEFAULT_FAST_MODEL = "claude-sonnet-5-5"; // Haiku 5.5 caught every planted bad claim but over-flagged real output; see docs/PRD.md section 9

/** Main model: analysis, rewrites and the cover letter. */
export const mainModel = (): string => process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

/** Fast model: the fact-check passes only. */
export const fastModel = (): string => process.env.ANTHROPIC_FAST_MODEL || DEFAULT_FAST_MODEL;
