import { z } from "zod";
import type { RoleContext, Voice } from "./types";

// Contract for the assessment call (PRD section 8). No server-only imports here, so the browser can use the types.
// The model-facing schema is kept small and flat: the API rejects a schema whose compiled grammar is too large.

const evidenceItem = z.object({
  label: z.string(), // two to four words
  text: z.string(), // one sentence
  sourceBulletId: z.string(), // a CV bullet ID such as "B4", "NOTES" for the candidate's notes, or "" if nothing is shown
  evidenceQuote: z.string(), // exact quote from that source, or ""
});

// What a plan bullet proposes. "shorten" and "cut" are for content that is not relevant to this job.
export const planActionSchema = z.enum(["reword", "reorder", "shorten", "cut"]);

export const requirementStatusSchema = z.enum(["yes", "partial", "no"]);

export const assessmentDraftSchema = z.object({
  // Flat strings first, so the model has read the job and the candidate's style before it writes anything.
  roleIndustry: z.string().default(""),
  roleSeniority: z.string().default(""),
  rolePriorities: z.string().default(""), // 3 to 5 things the role cares most about, separated by semicolons
  voiceDescription: z.string().default(""),
  voiceVerbs: z.string().default(""), // up to 8 verbs the candidate uses, comma separated, copied from the CV
  score: z.number().min(0).max(100),
  scoreReason: z.string(), // one line
  strengths: z.array(evidenceItem).max(5),
  gaps: z.array(evidenceItem).max(5),
  requirements: z
    .array(
      z.object({
        requirement: z.string(),
        status: requirementStatusSchema,
        note: z.string(), // a few words, empty for yes
        sourceBulletId: z.string(),
        evidenceQuote: z.string(),
      }),
    )
    .max(10),
  plan: z.array(z.object({ label: z.string(), action: planActionSchema, text: z.string() })).max(6),
  questions: z.array(z.object({ text: z.string(), ifSkipped: z.string() })).max(5),
});

export type AssessmentDraft = z.infer<typeof assessmentDraftSchema>;
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

/** A strength or gap as shown: the quote is checked in code and `evidenceQuote` is empty if it could not be verified. */
export type EvidenceItem = z.infer<typeof evidenceItem>;

export type Requirement = AssessmentDraft["requirements"][number];
export type PlanAction = z.infer<typeof planActionSchema>;
export type PlanItem = { label: string; action: PlanAction; text: string };
export type Question = { id: string; text: string; ifSkipped: string };

/** The checked assessment the app keeps and shows. */
export type Assessment = {
  score: number;
  scoreReason: string;
  strengths: EvidenceItem[];
  gaps: EvidenceItem[];
  requirements: Requirement[];
  plan: PlanItem[];
  questions: Question[];
  roleContext?: RoleContext;
  voice?: Voice;
};

/** The user's answer to one question. An empty or skipped answer is never sent to the draft. */
export type Answer = { id: string; question: string; answer: string };
