import { analysisResultSchema, computeOverall, type AnalysisResult } from "./types";

// One realistic mock result for the UI shell. Not real analysis output.
// Quotes cite bullet IDs; no number appears unless it is in the quoted
// original, otherwise a [placeholder] is used.

const raw = {
  scores: {
    roleMatch: { score: 72, reason: "Most core duties appear, but stakeholder reporting is thin." },
    impact: { score: 55, reason: "Several bullets describe duties without a clear outcome." },
    keywords: { score: 64, reason: "Key terms present; two requested tools are not shown." },
    clarity: { score: 80, reason: "Clear sections and consistent bullet structure." },
  },
  strengths: [
    {
      title: "Project delivery experience",
      whyItMatters: "The role centres on delivering programmes to deadlines.",
      sourceBulletId: "B3",
      evidenceQuote: "Led delivery of a customer portal migration across three teams",
    },
    {
      title: "Stakeholder communication",
      whyItMatters: "The advert asks for confident senior-level communication.",
      sourceBulletId: "B5",
      evidenceQuote: "Presented fortnightly progress updates to the steering group",
    },
  ],
  gaps: [
    {
      requirement: "Budget ownership",
      severity: "high",
      whatCvShows: "No bullet mentions managing or reporting on a budget.",
      howToHandle:
        "If you have managed costs in any role, add it truthfully. Otherwise accept this as a genuine gap.",
    },
    {
      requirement: "Experience with Jira",
      severity: "low",
      whatCvShows: "Agile delivery is mentioned, but no tracking tool is named.",
      howToHandle: "Add Jira only if you have actually used it; otherwise leave it out.",
    },
  ],
  rewrites: [
    {
      sourceBulletId: "B3",
      original: "Led delivery of a customer portal migration across three teams",
      lightTouch: "Led the customer portal migration across three teams, delivering it [on time / late].",
      strongerImpact:
        "Led a three-team customer portal migration that [outcome, e.g. reduced support contacts by X%].",
      whatChanged: "Adds the outcome and a place for the real result.",
      placeholders: ["[on time / late]", "[outcome]", "[X%]"],
      questionsForMe: ["What changed for customers after the migration?", "Was it delivered on schedule?"],
      verification: "pending",
    },
  ],
  achievements: {
    emphasise: [
      {
        title: "Customer portal migration",
        reason: "Directly matches the delivery focus of the role.",
        sourceBulletId: "B3",
        evidenceQuote: "Led delivery of a customer portal migration across three teams",
      },
    ],
    quantify: [
      {
        sourceBulletId: "B5",
        bullet: "Presented fortnightly progress updates to the steering group",
        metricToLookFor: "How large was the steering group, and what decisions did the updates support?",
      },
    ],
  },
  keywords: {
    present: ["stakeholder management", "agile delivery", "migration"],
    addTruthfully: [
      {
        keyword: "programme management",
        sourceBulletId: "B3",
        evidenceQuote: "Led delivery of a customer portal migration across three teams",
        suggestedSection: "Summary",
      },
    ],
    gaps: ["Jira", "budget management"],
  },
};

const parsed = analysisResultSchema.parse(raw);

export const mockResult: AnalysisResult = {
  ...parsed,
  scores: { ...parsed.scores, overall: computeOverall(parsed.scores) },
};
