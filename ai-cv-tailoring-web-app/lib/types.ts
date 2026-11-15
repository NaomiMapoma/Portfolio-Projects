import { z } from "zod";

// Analysis result contract, from PRD section 8.

const subScore = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(), // one line, under 20 words
});

export const scoresSchema = z.object({
  roleMatch: subScore,
  impact: subScore,
  keywords: subScore,
  clarity: subScore,
  // Calculated in code (40 / 25 / 20 / 15), never taken from the model.
  overall: z.number().min(0).max(100).optional(),
});

export const strengthSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  sourceBulletId: z.string(),
  evidenceQuote: z.string(),
});

export const gapSchema = z.object({
  requirement: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  whatCvShows: z.string(),
  howToHandle: z.string(),
});

// Step 4 engine schema: scores, strengths and gaps only. Gaps may cite the
// CV when it shows something related; both fields are empty when it shows nothing.
export const gapWithEvidenceSchema = gapSchema.extend({
  sourceBulletId: z.string(),
  evidenceQuote: z.string(),
});

// What the model returns for each rewrite. `original` is not included: code
// fills it in from the CV bullet so the model can never alter it.
export const rewriteDraftSchema = z.object({
  sourceBulletId: z.string(),
  lightTouch: z.string(),
  strongerImpact: z.string(), // one sentence
  whatChanged: z.string(), // under 25 words
  placeholders: z.array(z.string()),
  questionsForMe: z.array(z.string()),
});

// What the model returns for achievements and keywords (Step 7). Code checks
// and re-derives these before anything is shown. For `quantify`, the bullet
// text is filled in by code, and `metricToLookFor` is a question to the user.
export const achievementsDraftSchema = z.object({
  emphasise: z
    .array(
      z.object({
        title: z.string(),
        reason: z.string(),
        sourceBulletId: z.string(),
        evidenceQuote: z.string(),
      }),
    )
    .max(5), // ranked, most important first
  quantify: z
    .array(
      z.object({
        sourceBulletId: z.string(),
        metricToLookFor: z.string(),
      }),
    )
    .max(5),
});

export const keywordsDraftSchema = z.object({
  present: z.array(z.string()).max(15),
  addTruthfully: z
    .array(
      z.object({
        keyword: z.string(),
        sourceBulletId: z.string(),
        evidenceQuote: z.string(),
        suggestedSection: z.string(), // summary, skills, or a specific bullet
      }),
    )
    .max(10),
  gaps: z.array(z.string()).max(10),
  // Skills already written in the CV's skills section that matter most for this role. Checked in code.
  skillsToFront: z.array(z.string()).max(5).default([]),
});

// How the model read the role. Shown to the user so they can see (and spot a misreading in) what the rewrites
// were tailored to. Never used as evidence about the candidate.
export const roleContextSchema = z.object({
  industry: z.string(), // the sector the job is in, for example "retail e-commerce"
  seniority: z.string(), // for example "senior individual contributor"
  priorities: z.array(z.string()).max(5), // what the role cares most about, in the job's own words
});

// How the candidate writes, read from their own CV. Shown to the user and used to match tone. It describes style
// only and is never evidence about what the candidate has done. The model returns it as flat strings (see
// analysisCoreSchema); this is the checked form the app keeps.
export const voiceResultSchema = z.object({ description: z.string(), favouriteVerbs: z.array(z.string()).max(8) });

// roleContext and voice come first so the model has read the job and the candidate's style before it writes anything.
export const analysisCoreSchema = z.object({
  // Flat strings, all required (empty when there is nothing to say). Nested objects or optional fields here make the
  // compiled output grammar too large for the API. Code turns them into roleContext and voice after parsing.
  roleIndustry: z.string().default(""), // the sector the job is in
  roleSeniority: z.string().default(""),
  rolePriorities: z.string().default(""), // 3 to 5 things the role cares most about, separated by semicolons
  voiceDescription: z.string().default(""), // one or two sentences on how the candidate writes
  voiceVerbs: z.string().default(""), // up to 8 verbs or short phrases they use, comma separated, copied from the CV
  scores: scoresSchema.omit({ overall: true }),
  strengths: z.array(strengthSchema).max(8),
  gaps: z.array(gapWithEvidenceSchema).max(8),
  rewrites: z.array(rewriteDraftSchema).max(10).default([]),
  achievements: achievementsDraftSchema.default({ emphasise: [], quantify: [] }),
  keywords: keywordsDraftSchema.default({ present: [], addTruthfully: [], gaps: [], skillsToFront: [] }),
});

export const verificationSchema = z.enum(["pending", "supported", "check"]);

export const rewriteSchema = rewriteDraftSchema.extend({
  original: z.string(),
  verification: verificationSchema,
  // Unsupported claims named by the fact-checker (or why it could not run).
  issues: z.array(z.string()).default([]),
  // "summary" when the bullet is the personal summary paragraph. Filled in by code.
  kind: z.enum(["summary"]).optional(),
  // Machine-sounding writing noticed by code (never blocks a rewrite).
  styleNotes: z.array(z.string()).optional(),
});

export const achievementsSchema = z.object({
  emphasise: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
      sourceBulletId: z.string(),
      evidenceQuote: z.string(),
    }),
  ),
  quantify: z.array(
    z.object({
      sourceBulletId: z.string(),
      bullet: z.string(),
      metricToLookFor: z.string(),
    }),
  ),
});

export const keywordsSchema = z.object({
  present: z.array(z.string()),
  addTruthfully: z.array(
    z.object({
      keyword: z.string(),
      sourceBulletId: z.string(),
      evidenceQuote: z.string(),
      suggestedSection: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
  skillsToFront: z.array(z.string()).optional(),
});

export const analysisResultSchema = z.object({
  scores: scoresSchema,
  strengths: z.array(strengthSchema),
  gaps: z.array(gapSchema),
  rewrites: z.array(rewriteSchema),
  achievements: achievementsSchema,
  keywords: keywordsSchema,
  roleContext: roleContextSchema.optional(),
  voice: voiceResultSchema.optional(),
});

export type Scores = z.infer<typeof scoresSchema>;
export type RewriteDraft = z.infer<typeof rewriteDraftSchema>;
export type Rewrite = z.infer<typeof rewriteSchema>;
export type AnalysisCore = Omit<
  z.infer<typeof analysisCoreSchema>,
  "scores" | "rewrites" | "achievements" | "keywords" | "roleIndustry" | "roleSeniority" | "rolePriorities" | "voiceDescription" | "voiceVerbs"
> & {
  voice?: Voice;
  roleContext?: RoleContext;
  scores: Scores;
  rewrites: Rewrite[];
  achievements: z.infer<typeof achievementsSchema>;
  keywords: z.infer<typeof keywordsSchema>;
};

/** Per-rewrite edits kept in the browser tab's memory (never stored). */
export type RewriteEdit = {
  mode: "light" | "stronger";
  light: string;
  stronger: string;
  accepted: boolean;
};
export type Voice = z.infer<typeof voiceResultSchema>;
export type RoleContext = z.infer<typeof roleContextSchema>;
export type Strength = z.infer<typeof strengthSchema>;
export type Gap = z.infer<typeof gapSchema>;
export type Achievements = z.infer<typeof achievementsSchema>;
export type Keywords = z.infer<typeof keywordsSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** Overall score, calculated in code from the sub-scores. */
export function computeOverall(s: Scores): number {
  return Math.round(
    s.roleMatch.score * 0.4 +
      s.impact.score * 0.25 +
      s.keywords.score * 0.2 +
      s.clarity.score * 0.15,
  );
}
