import { z } from "zod";
import { assess } from "@/lib/assess";
import { AnalysisError } from "@/lib/claude";
import { NO_STORE, jsonError, readJson } from "@/lib/http";

// Runs the assessment call. CV, job description and notes text go only to the Claude API, from this server code.
// Request and response bodies are never logged.

const headers = NO_STORE;
const bodySchema = z.object({
  cv: z.string().trim().min(1),
  jd: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const raw = await readJson(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.value);
  if (!parsed.success) return jsonError("Please provide both a CV and a job description.", 400);
  const body = parsed.data;

  try {
    const { assessment, usage, dropped } = await assess(body.cv, body.jd, body.notes ?? "");
    return Response.json({ assessment, usage, dropped }, { headers });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return Response.json({ error: err.message }, { status: err.status, headers });
    }
    return Response.json({ error: "Something went wrong running the assessment." }, { status: 500, headers });
  }
}
