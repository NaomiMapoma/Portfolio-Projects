// Token audit (offline). Counts the API calls each step makes (assessment, draft, rework, letter), checks models
// come from the environment, every output is capped, thinking is off, retries are
// disabled, and prints prompt sizes. Uses a fake client: no API calls, no cost.
//
// Run: npx tsx scripts/audit-tokens.ts

import { jsonReply, kindOf } from "./test-utils";
import Anthropic from "@anthropic-ai/sdk";
import { assess, MAX_ASSESS_OUTPUT_TOKENS } from "../lib/assess";
import { getClient } from "../lib/claude";
import { draft, MAX_DRAFT_OUTPUT_TOKENS } from "../lib/draft";
import type { MessagesClient } from "../lib/claude-shared";
import { generateLetter, MAX_LETTER_TOKENS } from "../lib/letter";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const CV = `Jane Sample

EXPERIENCE
Programme Manager, Example Council
- Led delivery of a customer portal migration across three teams
- Presented fortnightly progress updates to the steering group
- Managed a team of 6 analysts and cut reporting time by 20%

SKILLS
Stakeholder management, agile delivery`;
const JD = "Senior Programme Manager. Lead delivery and manage stakeholders. Agile delivery.";

type Seen = { tool: string; params: Record<string, unknown> };
const assessment = {
  roleIndustry: "digital public services", roleSeniority: "senior", rolePriorities: "delivery; stakeholders", voiceDescription: "Plain.", voiceVerbs: "Led",
  score: 70, scoreReason: "Good match.",
  strengths: [{ label: "Delivery", text: "Led the portal migration.", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration" }],
  gaps: [], requirements: [{ requirement: "Delivery", status: "yes", note: "", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration" }],
  plan: [{ label: "Summary", action: "reword", text: "Lead with delivery." }],
  questions: [{ text: "Any figures?", ifSkipped: "I'll leave them out." }],
};
const draftReply = {
  changes: [{ sourceBulletId: "B3", action: "reword", newText: "Led the portal migration across three teams.", whatChanged: "Clearer.", source: "CV", evidenceQuote: "Led delivery of a customer portal migration" }],
  skillsToAdd: [], skillsToFront: [],
};
function spyClient() {
  const calls: Seen[] = [];
  const letter = `Dear Hiring Manager,\n\n${"I led the customer portal migration across three teams and kept the steering group informed. ".repeat(18)}\n\nKind regards,\nJane Sample`;
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const tool = kindOf(params);
        calls.push({ tool, params });
        const input =
          tool === "submit_assessment" ? assessment : tool === "submit_draft" ? draftReply : tool === "submit_letter" ? { letter } : tool === "submit_letter_verdict" ? { supported: true, unsupportedClaims: [] } : { verdicts: [{ id: "B3", supported: true, unsupportedClaims: [] }] };
        return jsonReply(input, { input_tokens: 1000, output_tokens: 300 });
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);
const sizeOf = (c: Seen) => {
  const sys = (c.params.system as { text: string }[]).map((s) => s.text).join("");
  const tools = JSON.stringify(c.params.output_config);
  return { system: approxTokens(sys), tools: approxTokens(tools), cachedPrefix: approxTokens(sys + tools) };
};

async function main() {
  process.env.ANTHROPIC_MODEL = "MAIN-MODEL-FROM-ENV";
  process.env.ANTHROPIC_FAST_MODEL = "FAST-MODEL-FROM-ENV";

  // ---------- The assessment ----------
  const as = spyClient();
  await assess(CV, JD, "", as.client);
  check("the assessment is exactly 1 API call, with no fact-check", as.calls.length === 1 && as.calls[0].tool === "submit_assessment");
  check("the assessment uses the main model from ANTHROPIC_MODEL", as.calls[0].params.model === "MAIN-MODEL-FROM-ENV");

  // ---------- The draft, on request only ----------
  const dr = spyClient();
  const context = { plan: [], requirements: [] };
  await draft({ cv: CV, jd: JD, answers: [], context }, dr.client);
  check("a draft is exactly 2 calls: the draft, then one batched fact-check", dr.calls.length === 2 && dr.calls[0].tool === "submit_draft" && dr.calls[1].tool === "submit_verdicts");
  check("the draft uses the main model and its fact-check uses the fast model", dr.calls[0].params.model === "MAIN-MODEL-FROM-ENV" && dr.calls[1].params.model === "FAST-MODEL-FROM-ENV");
  const rw = spyClient();
  await draft({ cv: CV, jd: JD, answers: [], context, previous: [{ id: "B3", action: "reword", newText: "Led it." }], feedback: "Shorter" }, rw.client);
  check("a rework is the same 2 calls again, nothing more", rw.calls.length === 2);

  // ---------- A letter, on request only ----------
  const lt = spyClient();
  await generateLetter({ cv: CV, jd: JD, accepted: [], gapKeywords: [] }, lt.client);
  check("a cover letter makes exactly 2 calls (letter, then fact-check), and only when asked for", lt.calls.length === 2 && lt.calls[0].tool === "submit_letter" && lt.calls[1].tool === "submit_letter_verdict");
  check("the letter uses the main model and its check uses the fast model", lt.calls[0].params.model === "MAIN-MODEL-FROM-ENV" && lt.calls[1].params.model === "FAST-MODEL-FROM-ENV");

  const all = [...as.calls, ...dr.calls, ...rw.calls, ...lt.calls];
  check("every call has an output cap (max_tokens)", all.every((c) => typeof c.params.max_tokens === "number" && (c.params.max_tokens as number) > 0));
  check("no call allows more than 8,000 output tokens", all.every((c) => (c.params.max_tokens as number) <= 8000));
  check("extended thinking is switched off on every call", all.every((c) => (c.params.thinking as { type: string } | undefined)?.type === "disabled"));
  check("every call asks for structured JSON output (no free text)", all.every((c) => (c.params.output_config as { format: { type: string } }).format.type === "json_schema" && !("tools" in c.params)));
  check("every call caches its static system prompt", all.every((c) => (c.params.system as { cache_control?: unknown }[]).every((s) => !!s.cache_control)));
  check("the CV and job description are never inside a cached system prompt", all.every((c) => !JSON.stringify(c.params.system).includes("Led delivery") && !JSON.stringify(c.params.system).includes("Senior Programme Manager")));

  // ---------- No hidden retries ----------
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  const real = getClient() as unknown as Anthropic;
  check("the API client has retries switched off (no silent resends)", real.maxRetries === 0);
  check("the API client has a timeout (not the 10 minute default)", real.timeout > 0 && real.timeout <= 120_000);
  delete process.env.ANTHROPIC_API_KEY;

  // ---------- Report ----------
  console.log("\nCall table (per run):");
  const rows: [string, Seen][] = [["assessment", as.calls[0]], ["draft", dr.calls[0]], ["draft fact-check", dr.calls[1]], ["cover letter", lt.calls[0]], ["letter fact-check", lt.calls[1]]];
  for (const [name, c] of rows) {
    const s = sizeOf(c);
    console.log(`  ${name.padEnd(34)} model=${String(c.params.model).padEnd(22)} max_tokens=${String(c.params.max_tokens).padEnd(5)} static prompt+schema ~${s.cachedPrefix} tokens`);
  }
  check("caps match the code constants", as.calls[0].params.max_tokens === MAX_ASSESS_OUTPUT_TOKENS && dr.calls[0].params.max_tokens === MAX_DRAFT_OUTPUT_TOKENS && lt.calls[0].params.max_tokens === MAX_LETTER_TOKENS);

  const small = rows.filter(([, c]) => sizeOf(c).cachedPrefix < 1024).map(([n]) => n);
  console.log(
    small.length
      ? `\n  NOTE: these static prompts are roughly under 1,024 tokens: ${small.join(", ")}. Prompt caching only applies above a minimum length (it differs by model), so they may not be cached at all. This is harmless but means no saving. The live script prints real cacheRead and cacheWrite counts to confirm.`
      : "\n  All static prompts are long enough that caching can apply (confirm with real cacheRead counts in the live script).",
  );
  console.log("  Real token counts per call need the live script (scripts/live-guided.ts).");

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
