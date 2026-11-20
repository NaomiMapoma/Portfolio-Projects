import { z } from "zod";
import { formatForPrompt, type Bullet } from "./bullets";
import { fastModel } from "./models";
import { extractJson, outputFormat } from "./structured";
import { createNoThinking } from "./call";
import type { MessagesClient, TokenUsage } from "./claude-shared";

const MAX_FACTCHECK_TOKENS = 2_000;

const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string(),
      supported: z.boolean(),
      unsupportedClaims: z.array(z.string()),
    }),
  ),
});

// ---------- Draft lines ----------
// The guided flow's draft is one new line per change, and the candidate's own answers and notes are evidence too.
// Still one batched request on the fast model, still separate from the call that wrote the draft.

const LINES_PROMPT = `You are a strict fact-checker for edits to a CV. You are given the candidate's whole CV as numbered bullets, then the candidate's ANSWERS to questions and their NOTES, then a list of items. Each item has the ORIGINAL line and the NEW line. The answers and notes are statements by the candidate themselves, so they count as true evidence, like the CV.

Mark an item supported only if every claim in the NEW line is stated in, or directly implied by, the ORIGINAL line, or is stated elsewhere in the CV about the SAME role (for example the job title or employer on the role line, or a tool in the skills section that the role clearly used), or is stated in an answer or the notes.
Mark it NOT supported if the NEW line:
- adds any fact that is not in the CV, the answers or the notes: a tool, skill, employer, job title, team size, scale, outcome, result or duration;
- borrows a fact from a different role or employer in the CV;
- exaggerates what the sources say (for example "led" instead of "contributed to", or "owned" instead of "supported");
- sounds broader or stronger than a hedged answer allows (for example an answer of "partly" or "roughly" must not become a flat, confident claim);
- uses a number that is not in the ORIGINAL line, an answer or the notes.
A SHORTENED line may drop detail but must not change the meaning or strength of what remains.
If the ORIGINAL is a personal summary or profile paragraph, apply the same test strictly to that paragraph: it may be reordered, tightened and restated in neutral, still-true words, and it may use facts that are stated in the candidate's answers or notes, but it must not add a brand, regulator, sector, result, number or team size that is not stated in the CV, the answers or the notes, and must not broaden the scope or strength of any claim.
The same figure written in a different way is the same number, so it is supported and must never be listed or described as a different budget or amount: "£5M+", "£5+ million", "over £5 million" and "5 million plus" are one amount; "8 years" matches "eight years". Only flag a figure whose amount, scope or strength actually differs from the sources.
Name each unsupported claim briefly (under 15 words, UK English). Return exactly one verdict for every item you are given, including every item whose NEW line is a shortened version of the ORIGINAL (use each item's ID exactly as given, and never skip an item, even when it looks obviously fine). List only claims that are NOT supported; never list a claim you consider supported.

Return only the JSON object that matches the schema. No other text.`;

export type LineToCheck = { id: string; original: string; text: string };
export type LineVerdict = { supported: boolean; issues: string[] };
export type LinesResult = {
  /** Verdict per line id. Empty if the check did not complete. */
  verdicts: Map<string, LineVerdict>;
  /** True when the check did not complete, so every line must be shown as unverified. */
  failed: boolean;
  usage: TokenUsage | null;
};

/**
 * Verify all new lines in a single request. Fails safe: if the check cannot run or comes back unreadable,
 * `failed` is true and the caller shows every line as unverified. Never retried. The text is never logged.
 */
export async function factCheckLines(
  client: MessagesClient,
  lines: LineToCheck[],
  bullets: Bullet[],
  answers: { id: string; answer: string }[],
  notes: string,
): Promise<LinesResult> {
  if (lines.length === 0) return { verdicts: new Map(), failed: false, usage: null };
  const evidence = [
    answers.length > 0 ? `ANSWERS:\n${answers.map((a) => `Answer ${a.id.replace(/^Q/, "")}: ${a.answer}`).join("\n")}` : "ANSWERS: (none)",
    notes.trim() ? `NOTES:\n${notes.trim()}` : "NOTES: (none)",
  ].join("\n\n");
  const items = lines.map((l) => `ID: ${l.id}\nORIGINAL: ${l.original}\nNEW: ${l.text}`).join("\n\n");
  const userMessage = `CV, as numbered bullets:\n\n${formatForPrompt(bullets)}\n\n---\n\n${evidence}\n\n---\n\nItems to check:\n\n${items}`;
  const started = Date.now();

  try {
    const response = await createNoThinking(client, {
      model: fastModel(),
      max_tokens: MAX_FACTCHECK_TOKENS,
      system: [{ type: "text", text: LINES_PROMPT, cache_control: { type: "ephemeral" } }],
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
      return { verdicts: new Map(), failed: true, usage };
    }
    console.info(`[factcheck] status=ok ms=${Date.now() - started} in=${usage.input} out=${usage.output}`);
    return {
      verdicts: new Map(parsed.data.verdicts.map((v) => [v.id, { supported: v.supported && v.unsupportedClaims.length === 0, issues: v.unsupportedClaims }])),
      failed: false,
      usage,
    };
  } catch {
    console.info(`[factcheck] status=api_error ms=${Date.now() - started}`);
    return { verdicts: new Map(), failed: true, usage: null };
  }
}
