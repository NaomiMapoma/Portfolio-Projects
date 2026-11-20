import { z } from "zod";
import { NO_STORE, jsonError, readJson } from "@/lib/http";
import { FRIENDLY_FETCH_ERROR, fetchJobDescription } from "@/lib/jd-text";

// Fetches a public job page server-side and returns its main text.
// In memory only. Request and response bodies are never logged.

const headers = NO_STORE;
const bodySchema = z.object({ url: z.string().trim().min(1).max(2000) });

export async function POST(request: Request) {
  const raw = await readJson(request, 10_000);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.value);
  if (!parsed.success) return jsonError("Please enter a web address.", 400);
  const url = parsed.data.url;

  try {
    const text = await fetchJobDescription(url);
    return Response.json({ text }, { headers });
  } catch {
    // Every failure (blocked address, login wall, timeout, JS-only page) gets the same friendly message.
    return Response.json({ error: FRIENDLY_FETCH_ERROR }, { status: 422, headers });
  }
}
