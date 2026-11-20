import type { MessagesClient } from "./claude-shared";

// Calls the Messages API with extended thinking switched OFF, whichever model is
// configured. The models disagree about how to say "off":
//   Haiku 5.5   accepts {type: "disabled"}
//   Sonnet 5.5  rejects that and asks for {type: "between_tools"}
// and a model with no thinking setting sent may think anyway (Haiku does), which
// burns the output cap. So: try "disabled"; if the API rejects it, try
// "between_tools"; if it rejects that too, send no setting. A rejected request
// is refused before any model runs, so it costs no tokens. The setting that
// works is remembered per model name, so there is at most one rejection per
// model per server start.

export type Reply = {
  content: { type: string; text?: string; input?: unknown }[];
  stop_reason?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
};

type Setting = "disabled" | "between_tools" | "omit";
const remembered = new Map<string, Setting>();

/** Forget what was learned (used by tests). */
export function resetThinkingMemory() {
  remembered.clear();
}

function rejectsThinking(err: unknown): boolean {
  const e = err as { status?: unknown; error?: { error?: { message?: unknown } }; message?: unknown };
  const msg = String(e.error?.error?.message ?? e.message ?? "");
  return e.status === 400 && /thinking/i.test(msg);
}

export async function createNoThinking(client: MessagesClient, params: Record<string, unknown>): Promise<Reply> {
  const create = client.messages.create.bind(client.messages) as unknown as (p: unknown) => Promise<Reply>;
  const model = String(params.model);
  const known = remembered.get(model);
  const order: Setting[] = known ? [known] : ["disabled", "between_tools", "omit"];

  let last: unknown;
  for (const setting of order) {
    const attempt = setting === "omit" ? params : { ...params, thinking: { type: setting } };
    try {
      const reply = await create(attempt);
      remembered.set(model, setting);
      return reply;
    } catch (err) {
      if (!rejectsThinking(err)) throw err;
      last = err;
    }
  }
  throw last;
}
