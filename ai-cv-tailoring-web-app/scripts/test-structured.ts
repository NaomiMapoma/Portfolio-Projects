// Checks for the structured-output request shape and error reporting, based on
// what the real Sonnet 5.5 and Haiku 5.5 APIs accepted and rejected. No API calls.
// Run: npx tsx scripts/test-structured.ts

import { z } from "zod";
import { assess, clampAssessment } from "../lib/assess";
import { assessmentDraftSchema } from "../lib/assess-types";
import { describeApiError } from "../lib/claude";
import type { MessagesClient } from "../lib/claude-shared";
import { extractJson, outputFormat, sanitizeSchema } from "../lib/structured";
import { jsonReply } from "./test-utils";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const UNSUPPORTED = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minItems", "maxItems", "minLength", "maxLength", "pattern", "default", "format", "$schema"];
const hasKey = (node: unknown, key: string): boolean =>
  Array.isArray(node) ? node.some((n) => hasKey(n, key)) : node && typeof node === "object" ? Object.entries(node).some(([k, v]) => k === key || hasKey(v, key)) : false;

async function main() {
  // ---------- The schema sent to the API ----------
  const raw = z.toJSONSchema(assessmentDraftSchema, { target: "draft-7" });
  check("the raw zod schema does contain keywords the API rejects (the cause of the 400)", UNSUPPORTED.some((k) => hasKey(raw, k)));
  const fmt = outputFormat(assessmentDraftSchema);
  check("the schema sent to the API has none of the unsupported keywords", UNSUPPORTED.every((k) => !hasKey(fmt.schema, k)));
  check("it is a json_schema format with the same properties", fmt.type === "json_schema" && Object.keys((fmt.schema as { properties: object }).properties).includes("score") && Object.keys((fmt.schema as { properties: object }).properties).includes("requirements"));
  check("objects keep additionalProperties false (required by the API)", (fmt.schema as { additionalProperties?: boolean }).additionalProperties === false);
  check("sanitizeSchema leaves enums and required lists alone", JSON.stringify(sanitizeSchema({ type: "string", enum: ["a", "b"], minLength: 2 })) === JSON.stringify({ type: "string", enum: ["a", "b"] }));

  // ---------- Reading the reply ----------
  const usage = { input_tokens: 1, output_tokens: 1 };
  check("JSON in a text block is read", JSON.stringify(extractJson({ content: [{ type: "text", text: '{"a":1}' }] })) === '{"a":1}');
  check("JSON wrapped in a code fence is read", JSON.stringify(extractJson({ content: [{ type: "text", text: '```json\n{"a":1}\n```' }] })) === '{"a":1}');
  check("thinking blocks before the answer are ignored", JSON.stringify(extractJson({ content: [{ type: "thinking" }, { type: "text", text: '{"a":2}' }] })) === '{"a":2}');
  check("a tool_use reply is still understood", JSON.stringify(extractJson({ content: [{ type: "tool_use", input: { a: 3 } }] })) === '{"a":3}');
  check("a cut-off answer (max_tokens) is treated as invalid", extractJson({ content: [{ type: "text", text: '{"a":' }], stop_reason: "max_tokens" }) === null);
  check("a refusal is treated as invalid", extractJson({ content: [{ type: "text", text: "I can't help" }], stop_reason: "refusal" }) === null);
  check("text that isn't JSON is treated as invalid", extractJson({ content: [{ type: "text", text: "Sure, here you go" }] }) === null);
  check("an empty reply is treated as invalid", extractJson({ content: [] }) === null);
  void usage;

  // ---------- Over-long lists and out-of-range scores no longer fail the run ----------
  const strength = (i: number) => ({ label: `S${i}`, text: "x", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration" });
  const messy = {
    roleIndustry: "", roleSeniority: "", rolePriorities: "", voiceDescription: "", voiceVerbs: "",
    score: 140, scoreReason: "a",
    strengths: Array.from({ length: 12 }, (_, i) => strength(i)),
    gaps: [], requirements: [], plan: [], questions: [],
  };
  let calls = 0;
  const client = { messages: { create: async () => (calls++, jsonReply(messy, { input_tokens: 10, output_tokens: 10 })) } } as unknown as MessagesClient;
  const out = await assess("Jane\n- Led delivery of a customer portal migration across three teams", "Job text", "", client);
  check("12 strengths and an out-of-range score are trimmed and clamped, not rejected (one call, no retry)", calls === 1 && out.assessment.strengths.length <= 5 && out.assessment.score === 100);
  check("clampAssessment alone keeps the schema valid", assessmentDraftSchema.safeParse(clampAssessment(messy)).success);

  // ---------- Error reporting ----------
  const api400 = describeApiError({ status: 400, error: { error: { message: "thinking: not supported on this model" } } });
  check("a 400 shows the API's own reason, not a guess about model names", api400.message.includes("thinking: not supported on this model") && api400.status === 502 && api400.apiStatus === 400);
  check("a 400 still points to the model settings in case that is the cause", /ANTHROPIC_MODEL/.test(api400.message));
  check("a 400 without detail still gives a usable message", /didn't accept the request/.test(describeApiError({ status: 400 }).message));
  check("401 says the key was rejected", /key was rejected/.test(describeApiError({ status: 401 }).message));
  check("429 says rate limited", /rate limiting/.test(describeApiError({ status: 429 }).message));
  check("529 and 500 say the API is busy", /busy/.test(describeApiError({ status: 529 }).message) && /busy/.test(describeApiError({ status: 500 }).message));
  check("a timeout is explained", /too long/.test(describeApiError({ name: "APIConnectionTimeoutError" }).message));
  check("a connection failure is explained", /internet/.test(describeApiError({ name: "APIConnectionError" }).message));
  check("a very long API detail is truncated", describeApiError({ status: 400, error: { error: { message: "x".repeat(900) } } }).message.length < 500);

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
