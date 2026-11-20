import Anthropic from "@anthropic-ai/sdk";
import type { MessagesClient, TokenUsage } from "./claude-shared";
import { MAX_CV_CHARS, MAX_JD_CHARS } from "./limits";

export type { MessagesClient, TokenUsage };

// Server side only. The shared Claude API client and its error reporting, used by the assessment, the draft and the
// cover letter. CV, job, notes and answer text is sent to the Claude API and nowhere else. It is never written to
// disk and never logged: only status, timing and token counts are logged.

export { MAX_CV_CHARS, MAX_JD_CHARS };

export class AnalysisError extends Error {
  constructor(
    message: string,
    public status: number,
    /** The HTTP status the Claude API returned (0 if none). Never includes any content. */
    public apiStatus = 0,
  ) {
    super(message);
  }
}

/** Turn an SDK error into a clear message. Only the status and error name are read: never the body. */
export function describeApiError(err: unknown): AnalysisError {
  const e = err as { status?: unknown; name?: unknown; error?: { error?: { message?: unknown } } };
  const status = typeof e.status === "number" ? e.status : 0;
  // The API's own explanation of what it rejected (a setting or model name, never our text).
  const detail = typeof e.error?.error?.message === "string" ? e.error.error.message.slice(0, 200) : "";
  const name = typeof e.name === "string" ? e.name : "";
  if (status === 401 || status === 403) {
    return new AnalysisError("The API key was rejected. Check ANTHROPIC_API_KEY in .env.local.", 502, status);
  }
  if (status === 400 || status === 404) {
    return new AnalysisError(
      `The Claude API didn't accept the request${detail ? `: ${detail}` : ""}. If this mentions the model, check ANTHROPIC_MODEL and ANTHROPIC_FAST_MODEL in .env.local.`,
      502,
      status,
    );
  }
  if (status === 429) {
    return new AnalysisError("The Claude API is rate limiting requests. Please wait a moment and try again.", 502, status);
  }
  if (status === 529 || status >= 500) {
    return new AnalysisError("The Claude API is busy right now. Please try again in a minute.", 502, status);
  }
  if (name === "APIConnectionTimeoutError") {
    return new AnalysisError("The Claude API took too long to answer. Please try again.", 502, status);
  }
  if (name === "APIConnectionError") {
    return new AnalysisError("Couldn't reach the Claude API. Check your internet connection and try again.", 502, status);
  }
  return new AnalysisError("The Claude API request failed. Please try again.", 502, status);
}

export function getClient(): MessagesClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("No API key found. Add ANTHROPIC_API_KEY to .env.local and restart the app.", 500);
  }
  // No hidden retries: a failed call is reported, not silently resent (one analysis call per run).
  return new Anthropic({ apiKey, maxRetries: 0, timeout: 90_000 });
}
