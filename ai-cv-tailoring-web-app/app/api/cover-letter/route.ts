import { z } from "zod";
import { AnalysisError } from "@/lib/claude";
import { NO_STORE, jsonError, readJson } from "@/lib/http";
import { MAX_ACCEPTED, MAX_ACCEPTED_CHARS, generateLetter } from "@/lib/letter";
import { MAX_ANSWER_CHARS, MAX_NOTES_CHARS, MAX_SAMPLE_CHARS } from "@/lib/limits";

// Generates a cover letter ONLY when the user clicks the button. CV and job text
// go only to the Claude API, from this server code. Request and response bodies
// are never logged.

const headers = NO_STORE;
const bodySchema = z.object({
  cv: z.string().trim().min(1),
  jd: z.string().trim().min(1),
  accepted: z
    .array(z.object({ id: z.string().max(20), text: z.string().max(MAX_ACCEPTED_CHARS * 2) }))
    .max(MAX_ACCEPTED)
    .default([]),
  answers: z
    .array(z.object({ id: z.string().max(10), question: z.string().max(600), answer: z.string().max(MAX_ANSWER_CHARS) }))
    .max(5)
    .default([]),
  notes: z.string().max(MAX_NOTES_CHARS * 2).optional(),
  gapKeywords: z.array(z.string().max(80)).max(30).default([]),
  roleContext: z
    .object({ industry: z.string().max(200), seniority: z.string().max(120), priorities: z.array(z.string().max(250)).max(5) })
    .optional(),
  voice: z.object({ description: z.string().max(600), favouriteVerbs: z.array(z.string().max(60)).max(8) }).optional(),
  writingSample: z.string().max(MAX_SAMPLE_CHARS * 2).optional(),
});

export async function POST(request: Request) {
  const raw = await readJson(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.value);
  if (!parsed.success) return jsonError("Please provide both a CV and a job description.", 400);
  const body = parsed.data;

  try {
    return Response.json(await generateLetter(body), { headers });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return Response.json({ error: err.message }, { status: err.status, headers });
    }
    return Response.json({ error: "Something went wrong writing the cover letter." }, { status: 500, headers });
  }
}
