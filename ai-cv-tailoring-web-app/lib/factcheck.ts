import { z } from "zod";
import { formatForPrompt, type Bullet } from "./bullets";
import { fastModel } from "./models";
import { extractJson, outputFormat } from "./structured";
import type { Rewrite } from "./types";
import { createNoThinking } from "./call";
import type { MessagesClient, TokenUsage } from "./claude-shared";

// One batched fact-check request on the fast model. It receives the whole CV
// as numbered bullets (so a rewrite can draw on the role line or another part
// of the same role) plus the rewrites. The job description and the main prompt
// are not sent. Never retried, so there is exactly one fact-check request per analysis.
// Text is never logged: only status, timing and token counts.

const MAX_FACTCHECK_TOKENS = 2_000;

const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string(),
      supported: z.boolean(),
      unsupportedClaims: z.array(z.string()),
    }),
  ),
  // One verdict per keyword claim (empty when there were none).
  keywordVerdicts: z.array(z.object({ keyword: z.string(), supported: z.boolean() })).default([]),
});

/** A keyword the analysis says the CV supports, with the quote offered as evidence. */
export type KeywordClaim = { keyword: string; sourceBulletId: string; evidenceQuote: string };

// Static: identical every run, so it can be cached.
const SYSTEM_PROMPT = `You are a strict fact-checker for CV rewrites. You are given the candidate's whole CV as numbered bullets, then a list of items. Each item has the ORIGINAL bullet and two rewrites of it (light touch and stronger impact).

Mark an item supported only if every claim in both rewrites is stated in, or directly implied by, the original bullet, or is stated elsewhere in the CV about the SAME role (for example the job title or employer on the role line, or a tool in the skills section that the role clearly used).
Mark it NOT supported if a rewrite:
- adds any fact that is not in the CV: a tool, skill, employer, job title, team size, scale, outcome, result or duration;
- borrows a fact from a different role or employer in the CV;
- exaggerates what the original says (for example "led" instead of "contributed to");
- uses a number that is not in the original bullet itself (numbers must come from the original bullet or be a placeholder).
If the ORIGINAL is a personal summary or profile paragraph, apply the same test strictly to that paragraph: a rewrite may reorder it, tighten it and restate a sector-specific claim in neutral, still-true words (for example "FCA financial promotion requirements" as "formal compliance review of creative"), but must not add a brand, regulator, sector, result, number or team size, and must not broaden the scope or strength of any claim (for example "managed £5M+" must not become "managed large budgets across the business").
Text inside [square brackets] is a placeholder for the candidate to fill in. Placeholders are allowed and are not unsupported claims.
Name each unsupported claim briefly (under 15 words, UK English). Check every item. List only claims that are NOT supported; never list a claim you consider supported.

You may also be given KEYWORD CLAIMS: a job description term and a quote from the CV offered as evidence that the candidate really has that skill in different words. Mark a keyword supported only if the quote shows the candidate genuinely did that same thing. A quote that only shows related, adjacent or more general work is NOT enough. A specific tool, product, programming language or qualification (for example Jira, AWS or PRINCE2) is supported only if the CV text actually names it. Give one keywordVerdicts entry per keyword claim, and none if there are no keyword claims.

Return only the JSON object that matches the schema. No other text.`;

export type FactCheckResult = {
  rewrites: Rewrite[];
  usage: TokenUsage | null;
  /** Lower-cased keyword -> supported. Null if the check did not complete (unverified). */
  keywordVerdicts: Map<string, boolean> | null;
};

function markAll(rewrites: Rewrite[], issue: string): Rewrite[] {
  return rewrites.map((r) => ({ ...r, verification: "check" as const, issues: [issue] }));
}

/**
 * Verify all rewrites, and any keyword claims, in a single request.
 * Fails safe: a rewrite that couldn't be verified is marked "check", and keyword
 * verdicts come back null so the caller can treat the claims as unverified.
 */
export async function factCheck(
  client: MessagesClient,
  rewrites: Rewrite[],
  bullets: Bullet[],
  /** Only the comparison script passes this; normal runs read ANTHROPIC_FAST_MODEL. */
  modelOverride?: string,
  keywordClaims: KeywordClaim[] = [],
): Promise<FactCheckResult> {
  if (rewrites.length === 0 && keywordClaims.length === 0) return { rewrites, usage: null, keywordVerdicts: new Map() };

  const model = modelOverride ?? fastModel();
  // The CV goes in the user message, after the cached system prompt.
  const items = rewrites
    .map(
      (r) =>
        `ID: ${r.sourceBulletId}\nORIGINAL: ${r.original}\nLIGHT TOUCH: ${r.lightTouch}\nSTRONGER IMPACT: ${r.strongerImpact}`,
    )
    .join("\n\n");
  const claims = keywordClaims
    .map((k) => `KEYWORD: ${k.keyword}\nEVIDENCE (${k.sourceBulletId}): ${k.evidenceQuote}`)
    .join("\n\n");
  const userMessage =
    `CV, as numbered bullets:\n\n${formatForPrompt(bullets)}\n\n---\n\nItems to check:\n\n${items || "(none)"}` +
    (claims ? `\n\n---\n\nKeyword claims to check:\n\n${claims}` : "");
  const started = Date.now();

  try {
    const response = await createNoThinking(client, {
      model,
      max_tokens: MAX_FACTCHECK_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { format: outputFormat(verdictsSchema) },
      messages: [{ role: "user", content: userMessage }],
    });

    const usage: TokenUsage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    };
    const json = extractJson(response);
    const parsed = json === null ? null : verdictsSchema.safeParse(json);

    if (!parsed?.success) {
      console.info(`[factcheck] status=invalid ms=${Date.now() - started} in=${usage.input} out=${usage.output}`);
      return { rewrites: markAll(rewrites, "The fact-check could not be completed. Check this rewrite yourself."), usage, keywordVerdicts: null };
    }

    const verdicts = new Map(parsed.data.verdicts.map((v) => [v.id, v]));
    const checked = rewrites.map((r): Rewrite => {
      const v = verdicts.get(r.sourceBulletId);
      if (!v) return { ...r, verification: "check", issues: ["The fact-check did not cover this rewrite."] };
      if (v.supported && v.unsupportedClaims.length === 0) return { ...r, verification: "supported", issues: [] };
      return {
        ...r,
        verification: "check",
        issues: v.unsupportedClaims.length > 0 ? v.unsupportedClaims : ["The fact-check flagged this rewrite."],
      };
    });
    console.info(`[factcheck] status=ok ms=${Date.now() - started} in=${usage.input} out=${usage.output}`);
    const keywordVerdicts = new Map(parsed.data.keywordVerdicts.map((v) => [v.keyword.trim().toLowerCase(), v.supported]));
    return { rewrites: checked, usage, keywordVerdicts };
  } catch {
    console.info(`[factcheck] status=api_error ms=${Date.now() - started}`);
    return { rewrites: markAll(rewrites, "The fact-check could not run. Check this rewrite yourself."), usage: null, keywordVerdicts: null };
  }
}
