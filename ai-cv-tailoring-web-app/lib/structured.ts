import { z } from "zod";

// Structured output for the Claude API. Sonnet 5.5 does not support forcing a
// tool call, so every call asks for JSON that matches a schema instead
// (output_config.format). Our own zod schemas still validate whatever comes back.

// The API's schema dialect does not accept these keywords. Our zod schemas still enforce them after parsing.
const UNSUPPORTED = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "pattern",
  "default",
  "format",
]);

export function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => !UNSUPPORTED.has(k))
        .map(([k, v]) => [k, sanitizeSchema(v)]),
    );
  }
  return node;
}

/** The `output_config.format` value for a zod schema. */
export function outputFormat(schema: z.ZodType): { type: "json_schema"; schema: { [k: string]: unknown } } {
  return {
    type: "json_schema",
    schema: sanitizeSchema(z.toJSONSchema(schema, { target: "draft-7" })) as { [k: string]: unknown },
  };
}

type ContentBlock = { type: string; text?: string; input?: unknown };

/**
 * Pull the JSON out of a response. Returns null if the answer was cut off, refused,
 * or isn't valid JSON, so the caller can treat it as an invalid response.
 */
export function extractJson(response: { content: ContentBlock[]; stop_reason?: string | null }): unknown | null {
  if (response.stop_reason === "max_tokens" || response.stop_reason === "refusal") return null;

  const tool = response.content.find((b) => b.type === "tool_use");
  if (tool) return tool.input ?? null;

  const text = response.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
  if (!text) return null;
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    return null;
  }
}
