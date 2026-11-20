// Shared helpers for the offline tests. The app asks the API for JSON that
// matches a schema, so a fake client works out which call it is from the schema
// the request asks for, and answers with that JSON in a text block.

export type Kind = "submit_draft" | "submit_assessment" | "submit_analysis" | "submit_letter" | "submit_letter_verdict" | "submit_verdicts";

/** Which call a request is, judged from the schema it asks for. */
export function kindOf(params: Record<string, unknown>): Kind {
  const format = (params.output_config as { format?: { schema?: { properties?: Record<string, unknown> } } } | undefined)?.format;
  const keys = Object.keys(format?.schema?.properties ?? {});
  if (keys.includes("changes")) return "submit_draft";
  if (keys.includes("requirements")) return "submit_assessment";
  if (keys.includes("scores")) return "submit_analysis";
  if (keys.includes("letter")) return "submit_letter";
  if (keys.includes("verdicts")) return "submit_verdicts";
  if (keys.includes("supported")) return "submit_letter_verdict";
  throw new Error(`Unrecognised request schema: ${keys.join(",")}`);
}

/** A model reply carrying `input` as JSON text, like the real API with structured output. */
export function jsonReply(input: unknown, usage: Record<string, number | null>, stop = "end_turn") {
  return { content: [{ type: "text", text: JSON.stringify(input) }], stop_reason: stop, usage };
}
