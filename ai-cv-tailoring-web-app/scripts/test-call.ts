// Checks the "thinking off" helper against the behaviour the real APIs showed:
// Haiku 5.5 accepts {type: "disabled"}; Sonnet 5.5 rejects it and asks for
// {type: "between_tools"}. No API calls: a fake client stands in.
// Run: npx tsx scripts/test-call.ts

import { createNoThinking, resetThinkingMemory } from "../lib/call";
import type { MessagesClient } from "../lib/claude-shared";
import { draft, MAX_DRAFT_OUTPUT_TOKENS } from "../lib/draft";
import { jsonReply } from "./test-utils";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    (this as unknown as { error: unknown }).error = { error: { message } };
  }
}

const SONNET_MSG = 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}. The model does not think before responding.';

/** Fake API. `accepts` lists the thinking settings a model allows ("omit" = no setting). */
function fake(accepts: Record<string, string[]>) {
  const requests: { model: string; thinking: string }[] = [];
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const model = String(params.model);
        const thinking = (params.thinking as { type: string } | undefined)?.type ?? "omit";
        requests.push({ model, thinking });
        if (model === "missing-model") throw new ApiError(404, "model: missing-model not found");
        if (model === "bad-key") throw new ApiError(401, "invalid x-api-key");
        if (!(accepts[model] ?? []).includes(thinking)) {
          throw new ApiError(400, thinking === "disabled" && (accepts[model] ?? []).includes("between_tools") ? SONNET_MSG : `thinking: setting "${thinking}" is not supported for this model`);
        }
        return jsonReply({ ok: true }, { input_tokens: 5, output_tokens: 5 });
      },
    },
  } as unknown as MessagesClient;
  return { client, requests };
}

async function main() {
  // ---------- Haiku-like: accepts "disabled" ----------
  resetThinkingMemory();
  const h = fake({ "haiku-like": ["disabled", "omit"] });
  await createNoThinking(h.client, { model: "haiku-like" });
  check("a model that accepts 'disabled' needs one request", h.requests.length === 1 && h.requests[0].thinking === "disabled");

  // ---------- Sonnet-like: rejects "disabled", wants "between_tools" ----------
  resetThinkingMemory();
  const s = fake({ "sonnet-like": ["between_tools", "omit"] });
  await createNoThinking(s.client, { model: "sonnet-like" });
  check("Sonnet's 400 makes it retry once with 'between_tools'", s.requests.map((r) => r.thinking).join() === "disabled,between_tools");
  await createNoThinking(s.client, { model: "sonnet-like" });
  await createNoThinking(s.client, { model: "sonnet-like" });
  check("the working setting is remembered: later calls make one request each", s.requests.length === 4 && s.requests.slice(2).every((r) => r.thinking === "between_tools"));

  // ---------- Per model ----------
  const both = fake({ "sonnet-like": ["between_tools"], "haiku-like": ["disabled"] });
  resetThinkingMemory();
  await createNoThinking(both.client, { model: "sonnet-like" });
  await createNoThinking(both.client, { model: "haiku-like" });
  check("settings are remembered per model name (changing models in .env.local just works)", both.requests.map((r) => `${r.model}:${r.thinking}`).join() === "sonnet-like:disabled,sonnet-like:between_tools,haiku-like:disabled");

  // ---------- A model that rejects every thinking setting ----------
  resetThinkingMemory();
  const none = fake({ "plain-model": ["omit"] });
  await createNoThinking(none.client, { model: "plain-model" });
  check("if every setting is rejected it sends none", none.requests.map((r) => r.thinking).join() === "disabled,between_tools,omit");

  // ---------- Other errors are not swallowed or retried ----------
  resetThinkingMemory();
  const e404 = fake({});
  let status = 0;
  try { await createNoThinking(e404.client, { model: "missing-model" }); } catch (e) { status = (e as { status: number }).status; }
  check("a wrong model name (404) is reported straight away, one request", status === 404 && e404.requests.length === 1);
  const e401 = fake({});
  let s401 = 0;
  try { await createNoThinking(e401.client, { model: "bad-key" }); } catch (e) { s401 = (e as { status: number }).status; }
  check("a rejected key (401) is reported straight away, one request", s401 === 401 && e401.requests.length === 1);

  // ---------- A whole draft against a Sonnet-like API ----------
  resetThinkingMemory();
  process.env.ANTHROPIC_MODEL = "sonnet-like";
  process.env.ANTHROPIC_FAST_MODEL = "haiku-like";
  const requests: { model: string; thinking: string; max: number }[] = [];
  const draftReply = {
    changes: [{ sourceBulletId: "B2", action: "reword", newText: "Led the portal migration across three teams.", whatChanged: "Clearer.", source: "CV", evidenceQuote: "Led delivery of a customer portal migration" }],
    skillsToAdd: [],
    skillsToFront: [],
  };
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const model = String(params.model);
        const thinking = (params.thinking as { type: string } | undefined)?.type ?? "omit";
        requests.push({ model, thinking, max: Number(params.max_tokens) });
        if (model === "sonnet-like" && thinking === "disabled") throw new ApiError(400, SONNET_MSG);
        const isDraft = Object.keys(((params.output_config as { format: { schema: { properties: object } } }).format.schema.properties)).includes("changes");
        return jsonReply(isDraft ? draftReply : { verdicts: [{ id: "B2", supported: true, unsupportedClaims: [] }] }, { input_tokens: 100, output_tokens: 50 });
      },
    },
  } as unknown as MessagesClient;
  const cv = "Jane\n\nEXPERIENCE\n- Led delivery of a customer portal migration across three teams";
  const input = { cv, jd: "Job text", answers: [], context: { plan: [], requirements: [] } };
  await draft(input, client);
  const modelCalls = requests.filter((r) => !(r.model === "sonnet-like" && r.thinking === "disabled"));
  check("a full draft on a Sonnet-like API: one draft and one fact-check that run, plus one free rejected request", modelCalls.length === 2 && requests.length === 3);
  check("the draft ran with 'between_tools' and the fact-check with 'disabled'", modelCalls[0].thinking === "between_tools" && modelCalls[1].thinking === "disabled");
  await draft(input, client);
  check("the next run makes no rejected request at all (exactly two requests)", requests.length === 5);
  check("output caps are sent on every request", requests.every((r) => r.max > 0) && requests[0].max === MAX_DRAFT_OUTPUT_TOKENS);
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_FAST_MODEL;

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
