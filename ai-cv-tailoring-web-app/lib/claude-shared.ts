import type Anthropic from "@anthropic-ai/sdk";

// Types shared by the analysis and fact-check modules (server side).

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** The slice of the SDK we use, so tests can pass a fake. */
export type MessagesClient = Pick<Anthropic, "messages">;
