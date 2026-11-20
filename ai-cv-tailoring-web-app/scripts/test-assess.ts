// Offline checks for the assessment call and its code checks. No API calls: a fake client stands in.
// Run: npx tsx scripts/test-assess.ts

import { assess, checkAssessment, clampAssessment, MAX_ASSESS_OUTPUT_TOKENS } from "../lib/assess";
import { assessmentDraftSchema, type AssessmentDraft } from "../lib/assess-types";
import { splitCv } from "../lib/bullets";
import { AnalysisError, type MessagesClient } from "../lib/claude";
import { MAX_NOTES_CHARS } from "../lib/limits";
import { jsonReply, kindOf } from "./test-utils";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const CV = `Jane Sample

EXPERIENCE
Programme Manager, Example Council
- Led delivery of a customer portal migration across three teams
- Presented fortnightly progress updates to the steering group
- Managed a team of 6 analysts and cut reporting time by 20%

SKILLS
Stakeholder management, agile delivery`;
// Bullets: B1 Jane Sample, B2 Programme Manager, B3 Led delivery, B4 Presented, B5 Managed, B6 Stakeholder...

const JD = `Senior Programme Manager

About Northbridge Digital
Northbridge Digital builds online services for residents.

WHAT YOU WILL DO
- Lead delivery of complex programmes to time and budget
- Use Jira to plan and track delivery
- Run steering groups`;

const NOTES = "Built a small app that tailors CVs to job descriptions. It is working and I use it every week.";

const base: AssessmentDraft = {
  roleIndustry: "digital public services",
  roleSeniority: "senior",
  rolePriorities: "delivery; steering groups; budget",
  voiceDescription: "Plain, past tense, no first person.",
  voiceVerbs: "Led, Presented, Invented",
  score: 66,
  scoreReason: "Strong on delivery, thin on budget and tools.",
  strengths: [
    { label: "Programme delivery", text: "Leading the portal migration is direct proof for a delivery role.", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration across three teams" },
    { label: "Governance", text: "Fortnightly steering group updates match the role.", sourceBulletId: "B4", evidenceQuote: "Presented fortnightly progress updates to the steering group" },
  ],
  gaps: [{ label: "Budget", text: "The role owns a budget. Your CV never mentions one.", sourceBulletId: "", evidenceQuote: "" }],
  requirements: [
    { requirement: "Programme delivery", status: "yes", note: "", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration across three teams" },
    { requirement: "Budget management", status: "no", note: "not stated", sourceBulletId: "", evidenceQuote: "" },
  ],
  plan: [{ label: "Summary", action: "reword", text: "Lead with digital programme delivery." }],
  questions: [{ text: "Have you used Jira or similar?", ifSkipped: "I'll leave Jira out." }],
};
const with_ = (over: Partial<AssessmentDraft>): AssessmentDraft => ({ ...base, ...over });
const { bullets } = splitCv(CV);
const run = (d: AssessmentDraft, notes = "") => checkAssessment(d, CV, JD, bullets, notes);

type Call = { system: { text: string }[]; messages: { content: string }[]; max_tokens: number };
function fake(replies: unknown[], usage = { input_tokens: 1000, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 800 }) {
  const calls: Call[] = [];
  let i = 0;
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        if (kindOf(params) !== "submit_assessment") throw new Error("unexpected call");
        calls.push(params as unknown as Call);
        const r = replies[Math.min(i++, replies.length - 1)];
        return typeof r === "string" ? { content: [{ type: "text", text: r }], stop_reason: "end_turn", usage } : jsonReply(r, usage);
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

async function main() {
  // ---------- The call ----------
  const f = fake([base]);
  const r = await assess(CV, JD, "", f.client);
  check("one call on success", f.calls.length === 1);
  check("usage is counted", r.usage.input === 1000 && r.usage.output === 300 && r.usage.cacheWrite === 800);
  check("output is capped", f.calls[0].max_tokens === MAX_ASSESS_OUTPUT_TOKENS);
  check("the CV and job are in the user message, not the cached system prompt", f.calls[0].messages[0].content.includes("B3: Led delivery") && f.calls[0].messages[0].content.includes("Northbridge") && !f.calls[0].system[0].text.includes("Northbridge"));
  check("the system prompt is cached", JSON.stringify(f.calls[0].system).includes("ephemeral"));
  check("no notes: no notes block", !f.calls[0].messages[0].content.includes("Notes from the candidate"));
  check("a good assessment passes through", r.assessment.strengths.length === 2 && r.assessment.score === 66 && r.assessment.requirements.length === 2);
  check("the schema asks for a score, not four sub-scores", Object.keys(assessmentDraftSchema.shape).includes("score") && !Object.keys(assessmentDraftSchema.shape).includes("scores"));

  const sys = f.calls[0].system[0].text;
  check("prompt: UK English", /UK English/.test(sys));
  check("prompt: cite a source and an exact quote", /exact quote/.test(sys) && /NOTES/.test(sys));
  check("prompt: do not inflate the score", /Do not inflate/.test(sys));
  check("prompt: questions say what happens if skipped", /ifSkipped/.test(sys));
  check("prompt: never suggest claiming experience", /Never suggest claiming/.test(sys));

  // ---------- Notes ----------
  const fn = fake([base]);
  await assess(CV, JD, NOTES, fn.client);
  check("notes are sent after the job description", fn.calls[0].messages[0].content.includes("Notes from the candidate") && fn.calls[0].messages[0].content.includes("tailors CVs"));
  let tooLong: AnalysisError | null = null;
  try {
    await assess(CV, JD, "x".repeat(MAX_NOTES_CHARS + 1), fake([base]).client);
  } catch (e) {
    tooLong = e as AnalysisError;
  }
  check("notes over the limit are refused", tooLong?.status === 413);

  // ---------- Score and lists ----------
  check("score above 100 is clamped", (clampAssessment({ ...base, score: 150 }) as { score: number }).score === 100);
  check("score below 0 is clamped and rounded", (clampAssessment({ ...base, score: -4 }) as { score: number }).score === 0 && (clampAssessment({ ...base, score: 66.6 }) as { score: number }).score === 67);
  const many = clampAssessment({ ...base, strengths: Array(9).fill(base.strengths[0]), questions: Array(9).fill(base.questions[0]) }) as AssessmentDraft;
  check("over-long lists are trimmed, not rejected", many.strengths.length === 5 && many.questions.length === 5 && assessmentDraftSchema.safeParse(many).success);

  // ---------- Strengths ----------
  check("a strength with a real quote is kept", run(base).assessment.strengths.length === 2);
  const fab = run(with_({ strengths: [{ ...base.strengths[0], evidenceQuote: "Ran the whole company" }, base.strengths[1]] }));
  check("a strength with a made-up quote is dropped", fab.assessment.strengths.length === 1 && fab.dropped.strengths === 1);
  const noQuote = run(with_({ strengths: [{ ...base.strengths[0], sourceBulletId: "", evidenceQuote: "" }] }));
  check("a strength with no quote is dropped", noQuote.assessment.strengths.length === 0);
  const wrongBullet = run(with_({ strengths: [{ ...base.strengths[0], sourceBulletId: "B4" }] }));
  check("a quote from a different bullet is dropped", wrongBullet.assessment.strengths.length === 0);
  const badNumber = run(with_({ strengths: [{ ...base.strengths[0], text: "Led delivery across 14 teams." }] }));
  check("a strength with a number that is not in the CV is dropped", badNumber.assessment.strengths.length === 0);
  const goodNumber = run(with_({ strengths: [{ label: "Team", text: "Managed a team of 6 and cut reporting time by 20%.", sourceBulletId: "B5", evidenceQuote: "Managed a team of 6 analysts and cut reporting time by 20%" }] }));
  check("a number from the CV is kept", goodNumber.assessment.strengths.length === 1);
  const jira = run(with_({ strengths: [{ label: "Jira", text: "Plans delivery.", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration across three teams" }] }));
  check("a strength claiming a tool the CV never names is dropped", jira.assessment.strengths.length === 0);
  const jiraText = run(with_({ strengths: [{ ...base.strengths[0], text: "Plans delivery in Jira." }] }));
  check("a strength whose sentence names such a tool is dropped", jiraText.assessment.strengths.length === 0);

  // ---------- Requirements ----------
  check("yes with a verified quote stays yes", run(base).assessment.requirements[0].status === "yes");
  const noEv = run(with_({ requirements: [{ requirement: "Programme delivery", status: "yes", note: "", sourceBulletId: "", evidenceQuote: "" }] }));
  check("yes with no evidence becomes partial", noEv.assessment.requirements[0].status === "partial" && noEv.assessment.requirements[0].note !== "" && noEv.dropped.requirementsAdjusted === 1);
  const tool = run(with_({ requirements: [{ requirement: "Jira", status: "yes", note: "", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration across three teams" }] }));
  check("yes for a named tool the CV never names becomes no", tool.assessment.requirements[0].status === "no");
  const toolNotes = run(with_({ requirements: [{ requirement: "Jira", status: "yes", note: "", sourceBulletId: "NOTES", evidenceQuote: "Jira" }] }), "I use Jira every day. Jira is great.");
  check("a tool named in the notes can be yes", toolNotes.assessment.requirements[0].status === "yes");
  const badEv = run(with_({ requirements: [{ requirement: "Steering groups", status: "partial", note: "related", sourceBulletId: "B4", evidenceQuote: "Chaired the board" }] }));
  check("partial with a made-up quote keeps the row but clears the evidence", badEv.assessment.requirements.length === 1 && badEv.assessment.requirements[0].evidenceQuote === "" && badEv.dropped.evidenceCleared === 1);
  check("a yes row has no note", run(base).assessment.requirements[0].note === "");

  // ---------- Gaps ----------
  const gapBad = run(with_({ gaps: [{ label: "Budget", text: "Nothing on budgets.", sourceBulletId: "B3", evidenceQuote: "Owned a £5M budget" }] }));
  check("a gap with a made-up quote keeps its text but loses the evidence", gapBad.assessment.gaps.length === 1 && gapBad.assessment.gaps[0].evidenceQuote === "");
  const gapGood = run(with_({ gaps: [{ label: "Scale", text: "Nearest is the migration.", sourceBulletId: "B3", evidenceQuote: "customer portal migration" }] }));
  check("a gap with a real quote keeps it", gapGood.assessment.gaps[0].evidenceQuote === "customer portal migration");

  // ---------- Plan ----------
  const planBad = run(with_({ plan: [{ label: "B5", action: "reword", text: "Say the team was 30 people." }, base.plan[0]] }));
  check("a plan bullet with an invented number is dropped", planBad.assessment.plan.length === 1 && planBad.dropped.planDropped === 1);
  const planOk = run(with_({ plan: [{ label: "B5", action: "reword", text: "Keep the team of 6 and the 20% saving." }] }));
  check("a plan bullet using the CV's own numbers is kept", planOk.assessment.plan.length === 1);
  const planGap = run(with_({ plan: [{ label: "Skills", action: "reword", text: "Add Jira only if you confirm it below." }] }));
  check("a plan bullet may name a gap tool when it says it needs confirming", planGap.assessment.plan.length === 1);

  // ---------- Cutting and shortening ----------
  check("prompt: may suggest shortening or cutting irrelevant content", /shortening or cutting content that is not relevant/.test(sys));
  check("prompt: prefer shortening to removing a whole role (it leaves a timeline gap)", /Prefer "shorten"/.test(sys) && /gap in the timeline/.test(sys));
  check("prompt: never cut what the role asks for", /Never cut or shorten something the role asks for/.test(sys));
  const cutPlan = run(with_({ plan: [{ label: "Earlier unrelated role", action: "shorten", text: "Reduce to one line: it is less relevant to this role." }, { label: "Hobbies", action: "cut", text: "Not relevant to a programme role." }] }));
  check("shorten and cut plan bullets are kept, with their action", cutPlan.assessment.plan.map((p) => p.action).join() === "shorten,cut");
  const odd = clampAssessment({ ...base, plan: [{ label: "x", action: " CUT ", text: "t" }, { label: "y", action: "delete everything", text: "t" }, { label: "z", text: "t" }] }) as AssessmentDraft;
  check("an action is normalised, and an unknown one becomes reword", odd.plan.map((p) => p.action).join() === "cut,reword,reword" && assessmentDraftSchema.safeParse(odd).success);

  // ---------- Bullet IDs never reach the reader ----------
  check("prompt: never write a bullet ID in any text", /Never write a bullet ID/.test(sys));
  const withIds = run(with_({ plan: [{ label: "Experience", action: "reorder", text: "Put the migration bullet (B5) and B4 first." }], scoreReason: "Strong (B5).", questions: [{ text: "Did B5 finish on time?", ifSkipped: "I'll leave B5 out." }] }));
  check("an ID the model wrote into the plan, the reason or a question is removed", !/\bB\d+\b/.test([withIds.assessment.scoreReason, ...withIds.assessment.plan.map((p) => `${p.label} ${p.text}`), ...withIds.assessment.questions.map((q) => `${q.text} ${q.ifSkipped}`)].join(" ")) && withIds.assessment.plan[0].text === "Put the migration bullet and that line first.");

  // ---------- Questions ----------
  const qs = run(with_({ questions: [{ text: "Q a", ifSkipped: "x" }, { text: "q A", ifSkipped: "x" }, { text: "  ", ifSkipped: "x" }, { text: "Q b", ifSkipped: "y" }] }));
  check("empty and duplicate questions are removed", qs.assessment.questions.length === 2);
  check("questions get ids", qs.assessment.questions.map((q) => q.id).join() === "Q1,Q2");
  check("each question keeps its if-skipped line", qs.assessment.questions[1].ifSkipped === "y");

  // ---------- Notes as evidence ----------
  const nStrength = { label: "Own project", text: "Built a CV tailoring app that is in use.", sourceBulletId: "NOTES", evidenceQuote: "It is working and I use it every week" };
  check("a strength quoting the notes is kept", run(with_({ strengths: [nStrength] }), NOTES).assessment.strengths.length === 1);
  check("the same quote is dropped when there are no notes", run(with_({ strengths: [nStrength] })).assessment.strengths.length === 0);
  check("a made-up quote from the notes is dropped", run(with_({ strengths: [{ ...nStrength, evidenceQuote: "It has 10,000 users" }] }), NOTES).assessment.strengths.length === 0);
  check("a figure in the notes is allowed in a strength", run(with_({ strengths: [{ ...nStrength, text: "Uses it every week, with 3 versions.", evidenceQuote: "I use it every week" }] }), NOTES + " Version 3 is out.").assessment.strengths.length === 1);

  // ---------- Role context and voice ----------
  const a = run(base).assessment;
  check("role context is built", a.roleContext?.industry === "digital public services" && a.roleContext.priorities.length === 3);
  check("voice verbs must be in the CV", a.voice?.favouriteVerbs.join() === "Led,Presented");

  // ---------- Bad output ----------
  const bad = fake(["not json", "still not json"]);
  let e1: AnalysisError | null = null;
  try {
    await assess(CV, JD, "", bad.client);
  } catch (e) {
    e1 = e as AnalysisError;
  }
  check("invalid assessment: exactly one retry then an error", bad.calls.length === 2 && e1?.status === 502);
  const recover = fake(["not json", base]);
  const r2 = await assess(CV, JD, "", recover.client);
  check("the retry can recover", recover.calls.length === 2 && r2.usage.input === 2000);
  let empty: AnalysisError | null = null;
  try {
    await assess("   ", JD, "", fake([base]).client);
  } catch (e) {
    empty = e as AnalysisError;
  }
  check("an empty CV is refused before any call", empty?.status === 400);

  if (failed > 0) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
