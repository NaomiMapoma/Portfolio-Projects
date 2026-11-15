import { z } from "zod";
import { AnalysisError, analyse } from "@/lib/claude";
import { NO_STORE, jsonError, readJson } from "@/lib/http";

// Runs the single analysis call. CV and job text go only to the Claude API,
// from this server code. Request and response bodies are never logged.

const headers = NO_STORE;
const bodySchema = z.object({ cv: z.string().trim().min(1), jd: z.string().trim().min(1) });

export async function POST(request: Request) {
  const raw = await readJson(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.value);
  if (!parsed.success) return jsonError("Please provide both a CV and a job description.", 400);
  const body = parsed.data;

  try {
    const { result, usage, factCheckUsage, dropped } = await analyse(body.cv, body.jd);
    return Response.json({ result, usage, factCheckUsage, dropped }, { headers });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return Response.json({ error: err.message }, { status: err.status, headers });
    }
    return Response.json({ error: "Something went wrong running the analysis." }, { status: 500, headers });
  }
}
