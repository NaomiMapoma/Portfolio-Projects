import { z } from "zod";
import type { PlanItem, Requirement } from "./assess-types";
import type { RoleContext, Voice } from "./types";

// Contract for the draft call (PRD section 8). No server-only imports here, so the browser can use the types.
// The model-facing schema is kept small and flat.

export const draftActionSchema = z.enum(["reword", "shorten", "cut"]);

export const draftChangeSchema = z.object({
  sourceBulletId: z.string(), // the CV line being changed, for example "B4"
  action: draftActionSchema,
  newText: z.string(), // the complete new line; empty for a cut
  whatChanged: z.string(), // under 25 words, naming the role priority it serves
  source: z.string(), // where the facts come from: "CV", "Answer 1" or "Notes"
  evidenceQuote: z.string(), // exact quote from that source
});

export const draftModelSchema = z.object({
  changes: z.array(draftChangeSchema).max(14),
  // Skills-line terms. Code checks every one against the CV, answers and notes and applies them itself.
  skillsToAdd: z.array(z.string()).max(6),
  skillsToFront: z.array(z.string()).max(8),
  // Reordering the bullets of one role: each entry is all of that role's bullet IDs in the new order, comma separated,
  // optionally followed by "|" and a short reason, for example "B6,B4,B5|Leads with delivery". Code checks every one.
  reorder: z.array(z.string()).max(4).default([]),
});

export type DraftAction = z.infer<typeof draftActionSchema>;
export type DraftChangeDraft = z.infer<typeof draftChangeSchema>;

/** A checked change as the app keeps and shows it. */
export type DraftChange = {
  /** The CV line this changes (internal; never shown to the reader). */
  id: string;
  action: DraftAction;
  original: string;
  /** The complete new line. Empty when the line is cut. */
  newText: string;
  whatChanged: string;
  /** "CV", "Answer n" or "Notes". */
  source: string;
  evidenceQuote: string;
  verification: "supported" | "check";
  /** Why the fact-check or a code check flagged it. Shown amber, with a way to use the original. */
  issues: string[];
  styleNotes?: string[];
  /** "summary" for the personal summary, "skills" for the skills line (made by code, not the model). */
  kind?: "summary" | "skills";
};

/** Reordering the bullets of one role. Applied as a text swap between positions. */
export type DraftMove = {
  /** The first bullet ID of the role's run of bullets. */
  key: string;
  /** All the run's bullet IDs in the new order. */
  ids: string[];
  /** The same IDs in the CV's own order. */
  original: string[];
  /** The role line above the bullets, or "" if there is none. */
  label: string;
  whatChanged: string;
};

/** The user's answer to one question, as sent to the draft. Only answered, unskipped questions are sent. */
export type DraftAnswer = { id: string; question: string; answer: string };

/** What the draft call needs to know from the assessment. */
export type DraftContext = {
  roleContext?: RoleContext;
  voice?: Voice;
  plan: PlanItem[];
  requirements: Requirement[];
};

/** A line from the previous draft, sent back when the user asks for a rework. */
export type PreviousChange = { id: string; action: DraftAction; newText: string };

export type DraftRejection = { label: string; reason: string };
