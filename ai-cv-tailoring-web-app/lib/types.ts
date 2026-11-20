import { z } from "zod";

// Small shared shapes for how the assessment read the role and the candidate's writing.

// How the model read the role. Shown to the user so they can spot a misreading. Never used as evidence about the candidate.
export const roleContextSchema = z.object({
  industry: z.string(), // the sector the job is in, for example "retail e-commerce"
  seniority: z.string(), // for example "senior individual contributor"
  priorities: z.array(z.string()).max(5), // what the role cares most about, in the job's own words
});

// How the candidate writes, read from their own CV. Used to match tone. It describes style only and is never evidence
// about what the candidate has done. The model returns it as flat strings (see assessmentDraftSchema); this is the
// checked form the app keeps.
export const voiceResultSchema = z.object({ description: z.string(), favouriteVerbs: z.array(z.string()).max(8) });

export type Voice = z.infer<typeof voiceResultSchema>;
export type RoleContext = z.infer<typeof roleContextSchema>;
