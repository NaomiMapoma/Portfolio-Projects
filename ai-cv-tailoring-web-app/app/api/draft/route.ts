import { z } from "zod";
import { planActionSchema, requirementStatusSchema } from "@/lib/assess-types";
import { AnalysisError } from "@/lib/claude";
import { MAX_ANSWER_CHARS, MAX_FEEDBACK_CHARS, draft } from "@/lib/draft";
import { draftActionSchema } from "@/lib/draft-types";
import { NO_STORE, jsonError, readJson } from "@/lib/http";

// Runs the draft call and its fact-check. CV, job description, notes and answer text go only to the Claude API,
// from this server code. Request and response bodies are never logged.

const headers = NO_STORE;

const bodySchema = z.object({
  cv: z.string().trim().min(1),
  jd: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  answers: z
    .array(z.object({ id: z.string().max(10), question: z.string().max(600), answer: z.string().max(MAX_ANSWER_CHARS) }))
    .max(5),
  context: z.object({
    roleContext: z
      .object({ industry: z.string().max(200), seniority: z.string().max(120), priorities: z.array(z.string().max(250)).max(5) })
      .optional(),
    voice: z.object({ description: z.string().max(500), favouriteVerbs: z.array(z.string().max(60)).max(8) }).optional(),
    plan: z.array(z.object({ label: z.string().max(200), action: planActionSchema, text: z.string().max(600) })).max(6),
    requirements: z
      .array(
        z.object({
          requirement: z.string().max(300),
          status: requirementStatusSchema,
          note: z.string().max(300),
          sourceBulletId: z.string().max(20),
          evidenceQuote: z.string().max(600),
        }),
      )
      .max(10),
  }),
  // On a rework: the previous draft and the user's instruction.
  previous: z
    .array(z.object({ id: z.string().max(20), action: draftActionSchema, newText: z.string().max(1500) }))
    .max(20)
    .optional(),
  feedback: z.string().trim().max(MAX_FEEDBACK_CHARS).optional(),
  keepOriginal: z.array(z.string().max(30)).max(30).optional(),
  previousOrder: z.array(z.string().max(300)).max(4).optional(),
});

export async function POST(request: Request) {
  const raw = await readJson(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.value);
  if (!parsed.success) return jsonError("That request couldn't be read.", 400);
  const body = parsed.data;

  try {
    const { changes, moves, skillsNote, rejections, usage, factCheckUsage } = await draft({
      cv: body.cv,
      jd: body.jd,
      notes: body.notes,
      answers: body.answers,
      context: body.context,
      previous: body.previous,
      feedback: body.feedback,
      keepOriginal: body.keepOriginal,
      previousOrder: body.previousOrder,
    });
    return Response.json({ changes, moves, skillsNote, rejections, usage, factCheckUsage }, { headers });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return Response.json({ error: err.message }, { status: err.status, headers });
    }
    return Response.json({ error: "Something went wrong drafting your CV." }, { status: 500, headers });
  }
}
