import { MAX_BODY_BYTES } from "./limits";

// Small helpers for the API routes. Request and response bodies are never logged.

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/** True if the request declares a body bigger than `max` bytes (checked before anything is parsed). */
export function tooLarge(request: Request, max: number): boolean {
  const length = Number(request.headers.get("content-length") ?? 0);
  return Number.isFinite(length) && length > max;
}

export const TOO_LARGE_MESSAGE =
  "That is too much text to send. Please shorten your CV or job description and try again.";

/**
 * Read a JSON body with a size cap. Returns a Response (413 or 400) if it can't be read,
 * otherwise the parsed value.
 */
export async function readJson(request: Request, max = MAX_BODY_BYTES): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  if (tooLarge(request, max)) return { ok: false, response: jsonError(TOO_LARGE_MESSAGE, 413) };
  try {
    const text = await request.text();
    if (text.length > max) return { ok: false, response: jsonError(TOO_LARGE_MESSAGE, 413) };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError("That request couldn't be read.", 400) };
  }
}
