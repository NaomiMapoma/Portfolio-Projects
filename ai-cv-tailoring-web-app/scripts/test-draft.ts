// Offline checks for the draft call, its code checks and its fact-check. No API calls: a fake client stands in.
// Run: npx tsx scripts/test-draft.ts

import { splitCv } from "../lib/bullets";
import { AnalysisError, type MessagesClient } from "../lib/claude";
import { MAX_ANSWER_CHARS, MAX_DRAFT_OUTPUT_TOKENS, DRAFT_PROMPT, checkDraft, draft, skillsChange, skillsOutcome, unshownRequirementWords } from "../lib/draft";
import type { DraftAnswer, DraftChangeDraft, DraftContext } from "../lib/draft-types";
import { jsonReply, kindOf } from "./test-utils";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const CV = `Jane Sample
Programme Manager

PROFILE
Programme manager with experience delivering digital change across public sector teams.

EXPERIENCE
Programme Manager, Example Council, 2019 to 2024
- Led delivery of a customer portal migration across three teams
- Presented fortnightly progress updates to the steering group
- Managed a team of six analysts and developers

Retail Assistant, High Street Books, 2012 to 2016
- Served customers and handled the till
- Helped to arrange window displays

SKILLS
Stakeholder management, agile delivery, risk and issue tracking, Excel`;
// B1 Jane Sample, B2 Programme Manager, B3 profile, B4 role line, B5 Led, B6 Presented, B7 Managed,
// B8 role line, B9 Served, B10 Helped, B11 skills.

const JD = `Senior Programme Manager

About Northbridge Digital
Northbridge Digital builds online services for residents.

WHAT YOU WILL DO
- Lead delivery of complex programmes to time and budget
- Own the programme budget
- Use Jira to plan and track delivery
- Run steering groups`;

const NOTES = "I built a small web app that tailors CVs to job descriptions. It works and I use it most weeks.";
const answers: DraftAnswer[] = [
  { id: "Q1", question: "Did you hold a budget?", answer: "Yes, I tracked the programme budget alongside delivery, partly." },
  { id: "Q2", question: "Have you used Jira?", answer: "I used Jira at Example Council to plan sprints for 4 sprints." },
];
const context: DraftContext = {
  roleContext: { industry: "digital public services", seniority: "senior", priorities: ["delivery", "budget", "steering groups"] },
  voice: { description: "Plain, past tense.", favouriteVerbs: ["Led", "Presented"] },
  plan: [
    { label: "Profile", action: "reword", text: "Lead with delivery." },
    { label: "Retail Assistant", action: "shorten", text: "Reduce to a line." },
    { label: "Retail Assistant", action: "cut", text: "Window displays are not relevant." },
  ],
  requirements: [
    { requirement: "Programme delivery", status: "yes", note: "", sourceBulletId: "B5", evidenceQuote: "Led delivery of a customer portal migration across three teams" },
    { requirement: "Jira", status: "no", note: "not named", sourceBulletId: "", evidenceQuote: "" },
    { requirement: "Own the programme budget", status: "no", note: "not stated", sourceBulletId: "", evidenceQuote: "" },
  ],
};
const { bullets } = splitCv(CV);

const ch = (over: Partial<DraftChangeDraft> & { sourceBulletId: string }): DraftChangeDraft => ({
  action: "reword",
  newText: "",
  whatChanged: "Leads with delivery.",
  source: "CV",
  evidenceQuote: "",
  ...over,
});
const led = ch({ sourceBulletId: "B5", newText: "Led the customer portal migration across three teams.", evidenceQuote: "Led delivery of a customer portal migration" });
const summary = ch({ sourceBulletId: "B3", newText: "Programme manager delivering digital change in the public sector.", evidenceQuote: "delivering digital change across public sector teams" });

const run = (raw: DraftChangeDraft[], over: { hasFeedback?: boolean; answers?: DraftAnswer[]; notes?: string; context?: DraftContext } = {}) =>
  checkDraft(raw, { cv: CV, jd: JD, notes: over.notes ?? "", answers: over.answers ?? answers, context: over.context ?? context, bullets, hasFeedback: over.hasFeedback ?? false });
const byId = (r: ReturnType<typeof run>, id: string) => r.changes.find((c) => c.id === id);

type Call = { system: { text: string }[]; messages: { content: string }[]; max_tokens: number };
function fake(draftReplies: unknown[], verdict: ((items: string[]) => unknown) | "bad" = (ids) => ({ verdicts: ids.map((id) => ({ id, supported: true, unsupportedClaims: [] })), keywordVerdicts: [] })) {
  const draftCalls: Call[] = [];
  const checkCalls: Call[] = [];
  let i = 0;
  const usage = { input_tokens: 1000, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const kind = kindOf(params);
        if (kind === "submit_draft") {
          draftCalls.push(params as unknown as Call);
          const r = draftReplies[Math.min(i++, draftReplies.length - 1)];
          return typeof r === "string" ? { content: [{ type: "text", text: r }], stop_reason: "end_turn", usage } : jsonReply(r, usage);
        }
        if (kind === "submit_verdicts") {
          checkCalls.push(params as unknown as Call);
          if (verdict === "bad") return { content: [{ type: "text", text: "nope" }], stop_reason: "end_turn", usage };
          const msg = (params as unknown as Call).messages[0].content;
          const ids = [...msg.matchAll(/^ID: (\S+)$/gm)].map((m) => m[1]);
          return jsonReply(verdict(ids), { input_tokens: 500, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
        }
        throw new Error("unexpected call");
      },
    },
  } as unknown as MessagesClient;
  return { client, draftCalls, checkCalls };
}
const input = { cv: CV, jd: JD, notes: "", answers, context };
const model = (changes: DraftChangeDraft[], skillsToAdd: string[] = [], skillsToFront: string[] = [], reorder: string[] = []) => ({ changes, skillsToAdd, skillsToFront, reorder });

async function main() {
  // ---------- The calls ----------
  const f = fake([model([summary, led])]);
  const r = await draft(input, f.client);
  check("one draft call and one fact-check call", f.draftCalls.length === 1 && f.checkCalls.length === 1);
  check("usage covers both calls", r.usage.input === 1500 && r.usage.output === 400);
  check("the draft output is capped", f.draftCalls[0].max_tokens === MAX_DRAFT_OUTPUT_TOKENS);
  check("the system prompt is cached and holds none of the CV or job", JSON.stringify(f.draftCalls[0].system).includes("ephemeral") && !DRAFT_PROMPT.includes("Northbridge") && !DRAFT_PROMPT.includes("Jane Sample"));
  const msg = f.draftCalls[0].messages[0].content;
  check("the CV, job, plan, answers are in the user message", msg.includes("B5: Led delivery") && msg.includes("Northbridge") && msg.includes("[shorten] Retail Assistant") && msg.includes("Answer 2 (to: Have you used Jira?)"));
  check("requirements not shown are listed as never to claim", /never claim these/.test(msg) && msg.includes("- Jira"));
  check("no notes: no notes block", !msg.includes("The candidate's notes"));
  check("no rework: no previous draft block", !msg.includes("Previous draft"));
  check("two changes come back", r.changes.length === 2 && r.changes[0].kind === "summary");
  check("supported lines are marked supported", r.changes.every((c) => c.verification === "supported"));
  check("the fact-check gets the answers as evidence", /ANSWERS:/.test(f.checkCalls[0].messages[0].content) && f.checkCalls[0].messages[0].content.includes("Answer 2: I used Jira"));
  check("the fact-check is its own request with its own prompt", f.checkCalls[0].system[0].text !== f.draftCalls[0].system[0].text && /fact-checker for edits/.test(f.checkCalls[0].system[0].text));
  check("prompt: never placeholders", /Never use placeholders/.test(DRAFT_PROMPT));
  check("prompt: UK English", /UK English/.test(DRAFT_PROMPT));
  check("prompt: shorten and cut only when the plan says", /Shorten and cut only content the plan says/.test(DRAFT_PROMPT));
  check("prompt: a line cannot be moved to another role or section", /cannot move a line to another role or section/.test(DRAFT_PROMPT));
  check("prompt: hedged answers stay hedged", /hedged/.test(DRAFT_PROMPT));

  // ---------- A good change, and the sources ----------
  const good = run([summary, led]);
  check("a good reword is kept", byId(good, "B5")?.newText === led.newText && !!byId(good, "B5")?.original.startsWith("Led delivery"));
  check("the summary comes first", good.changes[0].id === "B3");
  const badQuote = run([summary, { ...led, evidenceQuote: "Ran the whole company" }]);
  const crossLine = run([summary, ch({ sourceBulletId: "B5", newText: "Led the portal migration for the council.", evidenceQuote: "Programme Manager, Example Council" })]);
  check("a CV quote may come from another line of the CV (a role line, or for a summary)", !!byId(crossLine, "B5"));
  check("a change whose quote is nowhere in the CV is removed", !byId(badQuote, "B5") && badQuote.rejections.some((x) => /source quote/.test(x.reason)));
  const fromAnswer = run([summary, ch({ sourceBulletId: "B5", newText: "Led the portal migration and tracked its budget, partly.", source: "Answer 1", evidenceQuote: "I tracked the programme budget alongside delivery, partly" })]);
  check("a change can cite an answer", byId(fromAnswer, "B5")?.source === "Answer 1");
  check("an answer citation with the wrong number is removed", !byId(run([summary, ch({ sourceBulletId: "B5", newText: "Led the migration.", source: "Answer 2", evidenceQuote: "tracked the programme budget" })]), "B5"));
  check("an answer citation for an answer that was not given is removed", !byId(run([summary, ch({ sourceBulletId: "B5", newText: "Led the migration.", source: "Answer 3", evidenceQuote: "anything" })]), "B5"));
  const fromNotes = run([summary, ch({ sourceBulletId: "B6", newText: "Presented fortnightly updates, alongside building my own CV app.", source: "Notes", evidenceQuote: "It works and I use it most weeks" })], { notes: NOTES });
  check("a change can cite the notes", byId(fromNotes, "B6")?.source === "Notes");
  check("a made-up notes quote is removed", !byId(run([summary, ch({ sourceBulletId: "B6", newText: "x y z.", source: "Notes", evidenceQuote: "It has 10,000 users" })], { notes: NOTES }), "B6"));
  check("notes cited when there are none is removed", !byId(run([summary, ch({ sourceBulletId: "B6", newText: "x y z.", source: "Notes", evidenceQuote: "It works" })]), "B6"));
  check("an unknown source is removed", !byId(run([summary, { ...led, source: "my memory" }]), "B5"));
  check("'answer 2' in any case is accepted", byId(run([summary, ch({ sourceBulletId: "B5", newText: "Led the portal migration, planning sprints in Jira.", source: "answer 2", evidenceQuote: "used Jira at Example Council to plan sprints" })]), "B5")?.source === "Answer 2");

  // ---------- Numbers ----------
  check("an invented number is removed", !byId(run([summary, { ...led, newText: "Led the migration across 14 teams." }]), "B5"));
  check("a number from the original line is kept", !!byId(run([summary, ch({ sourceBulletId: "B7", newText: "Managed six analysts and developers.", evidenceQuote: "Managed a team of six analysts" })]), "B7"));
  check("a number from an answer is allowed", !!byId(run([summary, ch({ sourceBulletId: "B5", newText: "Led the migration, planning 4 sprints in Jira.", source: "Answer 2", evidenceQuote: "plan sprints for 4 sprints" })]), "B5"));
  const sumNum = run([ch({ sourceBulletId: "B3", newText: "Programme manager delivering 20 programmes in the public sector.", evidenceQuote: "delivering digital change across public sector teams" })]);
  check("a summary with an invented number is replaced by the original, amber, naming the figure", byId(sumNum, "B3")?.newText === byId(sumNum, "B3")?.original && byId(sumNum, "B3")?.verification === "check" && /"20"/.test(byId(sumNum, "B3")?.issues.join(" ") ?? ""));
  check("a [placeholder] is removed: there are none in this flow", !byId(run([summary, { ...led, newText: "Led the migration across [X] teams." }]), "B5"));
  const sumPh = run([ch({ sourceBulletId: "B3", newText: "Programme manager delivering [number] programmes.", evidenceQuote: "delivering digital change across public sector teams" })]);
  check("a summary with a [placeholder] is replaced by the original, amber", byId(sumPh, "B3")?.newText === byId(sumPh, "B3")?.original && byId(sumPh, "B3")?.verification === "check");

  // ---------- Things that must not be claimed ----------
  const jira = run([summary, ch({ sourceBulletId: "B6", newText: "Presented fortnightly updates and tracked delivery in Jira.", evidenceQuote: "Presented fortnightly progress updates" })], { answers: [] });
  check("a tool the CV, answers and notes never show is removed", !byId(jira, "B6") && jira.rejections.some((x) => /Jira/.test(x.reason)));
  const jiraOk = run([summary, ch({ sourceBulletId: "B6", newText: "Presented fortnightly updates and tracked delivery in Jira.", evidenceQuote: "Presented fortnightly progress updates" })]);
  check("the same tool is allowed once an answer confirms it", !!byId(jiraOk, "B6"));
  const sumGap = run([ch({ sourceBulletId: "B3", newText: "Programme manager using Jira across public sector teams.", evidenceQuote: "delivering digital change across public sector teams" })], { answers: [] });
  check("a summary claiming a requirement nothing shows is kept amber with the reason", byId(sumGap, "B3")?.verification === "check" && /Jira/.test(byId(sumGap, "B3")?.issues.join(" ") ?? ""));
  const sumName = run([ch({ sourceBulletId: "B3", newText: "Programme manager delivering digital change for Acme Corp and public sector teams.", evidenceQuote: "delivering digital change across public sector teams" })]);
  check("a name added to the summary is flagged amber", byId(sumName, "B3")?.verification === "check" && /Acme/.test(byId(sumName, "B3")?.issues.join(" ") ?? ""));

  // ---------- Lines that are never changed ----------
  check("a skills line is never rewritten", !byId(run([summary, ch({ sourceBulletId: "B11", newText: "Stakeholder management, Jira.", evidenceQuote: "Stakeholder management" })]), "B11"));
  check("the name line is never changed", !byId(run([summary, ch({ sourceBulletId: "B1", newText: "Jane A. Sample", evidenceQuote: "Jane Sample" })]), "B1"));
  const roleLine = run([summary, ch({ sourceBulletId: "B4", newText: "Senior Programme Manager, Example Council, 2019 to 2024", evidenceQuote: "Programme Manager, Example Council" })]);
  check("a job title, employer and dates line is never changed", !byId(roleLine, "B4") && roleLine.rejections.some((x) => /job titles, employers and dates/.test(x.reason)));
  check("the title line under the name is never changed", !byId(run([summary, ch({ sourceBulletId: "B2", newText: "Senior Programme Manager", evidenceQuote: "Programme Manager" })]), "B2"));
  check("an unknown bullet is removed", run([summary, { ...led, sourceBulletId: "B99" }]).rejections.some((x) => /isn't in your CV/.test(x.reason)));
  check("a second change for the same line is ignored", run([summary, led, { ...led, newText: "Something else entirely." }]).rejections.some((x) => /second suggestion/.test(x.reason)));
  check("an unchanged line is dropped silently", !byId(run([summary, ch({ sourceBulletId: "B5", newText: "Led delivery of a customer portal migration across three teams", evidenceQuote: "Led delivery" })]), "B5"));
  check("an empty new line is removed", !byId(run([summary, { ...led, newText: "  " }]), "B5"));

  // ---------- Cutting and shortening ----------
  const cut = run([summary, ch({ sourceBulletId: "B10", action: "cut", whatChanged: "Not relevant to a programme role." })]);
  check("a cut the plan asked for is kept, with no new text", byId(cut, "B10")?.action === "cut" && byId(cut, "B10")?.newText === "" && byId(cut, "B10")?.verification === "supported");
  const noCutPlan: DraftContext = { ...context, plan: [{ label: "Profile", action: "reword", text: "Lead with delivery." }] };
  const cutNo = run([summary, ch({ sourceBulletId: "B10", action: "cut" })], { context: noCutPlan });
  check("a cut that was not in the plan is removed", !byId(cutNo, "B10") && cutNo.rejections.some((x) => /wasn't part of the plan/.test(x.reason)));
  check("a cut is allowed when the user asked for it in a rework", byId(run([summary, ch({ sourceBulletId: "B10", action: "cut" })], { context: noCutPlan, hasFeedback: true }), "B10")?.action === "cut");
  const cutSummary = run([ch({ sourceBulletId: "B3", action: "cut" })]);
  check("the summary is never cut", byId(cutSummary, "B3")?.action === "reword" && byId(cutSummary, "B3")?.newText === byId(cutSummary, "B3")?.original);
  check("a cut role line is refused", !byId(run([summary, ch({ sourceBulletId: "B8", action: "cut" })]), "B8"));
  const short = run([summary, ch({ sourceBulletId: "B9", action: "shorten", newText: "Customer service and till work.", evidenceQuote: "Served customers and handled the till" })]);
  check("a real shortening keeps the shorten action", byId(short, "B9")?.action === "shorten");
  const notShort = run([summary, ch({ sourceBulletId: "B9", action: "shorten", newText: "Served customers and handled the till in a busy shop every day.", evidenceQuote: "Served customers and handled the till" })]);
  check("a 'shorten' that is longer becomes a plain reword", byId(notShort, "B9")?.action === "reword");
  check("shorten without a cut/shorten plan becomes a reword", byId(run([summary, ch({ sourceBulletId: "B9", action: "shorten", newText: "Till work.", evidenceQuote: "handled the till" })], { context: noCutPlan }), "B9")?.action === "reword");

  // ---------- The summary always appears ----------
  const none = run([led]);
  check("a skipped summary comes back as the original, amber, first", none.changes[0].kind === "summary" && none.changes[0].newText === none.changes[0].original && none.changes[0].verification === "check");
  const badSummary = run([{ ...summary, evidenceQuote: "invented quote" }]);
  check("a summary with an unverifiable source is replaced by the original, amber", byId(badSummary, "B3")?.newText === byId(badSummary, "B3")?.original && byId(badSummary, "B3")?.verification === "check");

  // ---------- The fact-check is merged ----------
  const f2 = fake([model([summary, led])], (ids) => ({ verdicts: ids.map((id) => ({ id, supported: id !== "B5", unsupportedClaims: id === "B5" ? ["Says 'on time', which the CV does not"] : [] })), keywordVerdicts: [] }));
  const r2 = await draft(input, f2.client);
  check("an unsupported line is amber with the fact-checker's reason", r2.changes.find((c) => c.id === "B5")?.verification === "check" && /on time/.test(r2.changes.find((c) => c.id === "B5")?.issues.join(" ") ?? ""));
  check("a supported line stays supported", r2.changes.find((c) => c.id === "B3")?.verification === "supported");
  const f3 = fake([model([summary, led])], "bad");
  const r3 = await draft(input, f3.client);
  check("if the fact-check can't be read every line is amber, and nothing is hidden", r3.changes.length === 2 && r3.changes.every((c) => c.verification === "check" && /could not run/.test(c.issues.join(" "))));
  check("the fact-check is never retried", f3.checkCalls.length === 1);
  const f4 = fake([model([summary, led])], (ids) => ({ verdicts: ids.filter((id) => id !== "B5").map((id) => ({ id, supported: true, unsupportedClaims: [] })), keywordVerdicts: [] }));
  const r4 = await draft(input, f4.client);
  check("a line the fact-check missed is amber", r4.changes.find((c) => c.id === "B5")?.verification === "check" && /did not cover/.test(r4.changes.find((c) => c.id === "B5")?.issues.join(" ") ?? ""));
  const f5 = fake([model([summary, ch({ sourceBulletId: "B10", action: "cut" })])]);
  const r5 = await draft(input, f5.client);
  check("cuts are not sent to the fact-check", !/ID: B10/.test(f5.checkCalls[0].messages[0].content));
  const f6 = fake([model([ch({ sourceBulletId: "B10", action: "cut" })])]);
  const r6 = await draft({ ...input, cv: CV }, f6.client);
  check("the summary original is not fact-checked as a change either", !/ID: B3/.test(f6.checkCalls[0]?.messages[0].content ?? "") && r6.changes[0].kind === "summary");
  const f7 = fake([model([ch({ sourceBulletId: "B3", newText: "Programme manager using Jira across public sector teams.", evidenceQuote: "delivering digital change across public sector teams" })])], (ids) => ({ verdicts: ids.map((id) => ({ id, supported: true, unsupportedClaims: [] })), keywordVerdicts: [] }));
  const r7 = await draft({ ...input, answers: [] }, f7.client);
  check("a code flag keeps a line amber even when the fact-check passes it", r7.changes[0].verification === "check" && r7.changes[0].issues.length > 0);
  void r5;

  // ---------- The skills line ----------
  const s1 = skillsChange(CV, ["Jira"], [], answers, "");
  check("a term an answer confirms is added to the skills line", s1?.newText === "Stakeholder management, agile delivery, risk and issue tracking, Excel, Jira" && s1?.source === "Your answers");
  check("a term nothing confirms is not added", skillsChange(CV, ["Kubernetes"], [], answers, "") === null);
  check("a term in the notes can be added", skillsChange(CV, ["web app"], [], [], NOTES)?.source === "Notes");
  check("skills move to the front, none removed", skillsChange(CV, [], ["Excel", "agile delivery"], [], "")?.newText === "Excel, agile delivery, Stakeholder management, risk and issue tracking");
  check("the note does not claim a move when the order did not change", !/front/.test(skillsChange(CV, ["Jira"], ["Stakeholder management"], answers, "")?.whatChanged ?? "x") && /front/.test(skillsChange(CV, [], ["Excel"], [], "")?.whatChanged ?? ""));
  check("nothing to change: no skills change", skillsChange(CV, [], [], [], "") === null && skillsChange(CV, ["Excel"], [], [], "") === null);
  const f8 = fake([model([summary], ["Jira", "Kubernetes"], ["Excel"])]);
  const r8 = await draft(input, f8.client);
  const sk = r8.changes.find((c) => c.id === "B11");
  check("the draft includes the skills line change, made by code", sk?.newText === "Excel, Stakeholder management, agile delivery, risk and issue tracking, Jira" && sk?.verification === "supported");
  check("the skills line is not sent to the fact-check", !/ID: B11/.test(f8.checkCalls[0].messages[0].content));

  // ---------- Answers, notes, rework ----------
  const f9 = fake([model([summary])]);
  await draft({ ...input, answers: [{ id: "Q1", question: "q", answer: "   " }, { id: "Q2", question: "q2", answer: "x".repeat(MAX_ANSWER_CHARS + 500) }] }, f9.client);
  const m9 = f9.draftCalls[0].messages[0].content;
  check("an empty answer is never sent", !m9.includes("Answer 1 (to: q)"));
  check("a very long answer is cut to the limit", !m9.includes("x".repeat(MAX_ANSWER_CHARS + 1)) && m9.includes("x".repeat(MAX_ANSWER_CHARS)));
  const fa = fake([model([summary])]);
  await draft({ ...input, answers: [] }, fa.client);
  check("with no answers the model is told they skipped every question", /they skipped every question/.test(fa.draftCalls[0].messages[0].content));
  const fn = fake([model([summary])]);
  await draft({ ...input, notes: NOTES }, fn.client);
  check("notes are sent after the answers", fn.draftCalls[0].messages[0].content.includes("cite as \"Notes\"") && fn.draftCalls[0].messages[0].content.includes("tailors CVs"));
  const fr = fake([model([summary, ch({ sourceBulletId: "B10", action: "cut" })])]);
  const rr = await draft({ ...input, previous: [{ id: "B5", action: "reword", newText: "Led the migration." }], feedback: "Cut the window displays line", context: noCutPlan }, fr.client);
  const mr = fr.draftCalls[0].messages[0].content;
  check("a rework sends the previous draft and the instruction", mr.includes("Previous draft") && mr.includes("- B5 [reword]: Led the migration.") && mr.includes("Cut the window displays line"));
  check("a rework may cut what the user asked to cut", rr.changes.some((c) => c.id === "B10" && c.action === "cut"));
  let long: AnalysisError | null = null;
  try {
    await draft({ ...input, feedback: "x".repeat(600) }, fake([model([summary])]).client);
  } catch (e) {
    long = e as AnalysisError;
  }
  check("an over-long instruction is refused", long?.status === 413);

  // ---------- Reordering the bullets of one role ----------
  check("prompt: the model may reorder the bullets under one role, in a stated format, and never across roles", /reorder: only when the plan says/.test(DRAFT_PROMPT) && /ALL the bullet IDs under one role/.test(DRAFT_PROMPT) && /never mix roles/.test(DRAFT_PROMPT));
  const fm = fake([model([summary], [], [], ["B7,B5,B6|Leads with the team"])]);
  const rm = await draft(input, fm.client);
  check("a clean reorder comes back as a move, with its reason", rm.moves.length === 1 && rm.moves[0].ids.join() === "B7,B5,B6" && rm.moves[0].whatChanged === "Leads with the team");
  check("a reorder needs no fact-check (no new wording)", !/ID: B7/.test(fm.checkCalls[0].messages[0].content));
  const fm2 = fake([model([summary], [], [], ["B7,B5", "B9,B5,B6"])]);
  const rm2 = await draft(input, fm2.client);
  check("a bad reorder is dropped with a plain reason and nothing else is lost", rm2.moves.length === 0 && rm2.rejections.some((r) => /left out, repeated or mixed|aren't a list/.test(r.reason)) && rm2.changes.some((c) => c.kind === "summary"));
  const fm3 = fake([model([summary, ch({ sourceBulletId: "B6", action: "cut" })], [], [], ["B7,B5,B6"])]);
  const rm3 = await draft(input, fm3.client);
  check("a reorder that includes a cut line is refused", rm3.moves.length === 0 && rm3.rejections.some((r) => /also being cut/.test(r.reason)));
  const fm4 = fake([model([summary], [], [], ["B7,B5,B6"])]);
  const rm4 = await draft({ ...input, previous: [{ id: "B5", action: "reword", newText: "Led it." }], previousOrder: ["B7,B5,B6|x"], feedback: "Keep the order", keepOriginal: ["order:B5"] }, fm4.client);
  check("a rework is told the previous order, and a role the user put back is not reordered again", /Previous order of bullets/.test(fm4.draftCalls[0].messages[0].content) && fm4.draftCalls[0].messages[0].content.includes("- B7,B5,B6") && rm4.moves.length === 0);
  const fm5 = fake([model([summary])]);
  check("a reply with no reorder field at all still works", (await draft(input, fm5.client)).moves.length === 0);

  // ---------- The skills line: say why a term was not added ----------
  const noList = "Jane\n\nEXPERIENCE\n- Led delivery of a customer portal migration\n\nSKILLS\n- Excel\n- SQL";
  const o1 = skillsOutcome(noList, ["Jira"], [], answers, "");
  check("skills as separate bullets: nothing is added, and the user is told to add it by hand", o1.change === null && /couldn't add Jira to your skills line/.test(o1.note) && /by hand/.test(o1.note));
  const o2 = skillsOutcome(CV, ["Kubernetes", "Jira"], [], answers, "");
  check("a term nothing confirms is named as left out, and the confirmed one is still added", o2.change?.newText.endsWith("Jira") === true && /left Kubernetes out/.test(o2.note));
  check("nothing suggested: no note", skillsOutcome(CV, [], [], answers, "").note === "" && skillsOutcome(CV, ["Jira"], [], answers, "").note === "");
  check("moving skills on a line that is not a list is explained", /couldn't reorder your skills line/.test(skillsOutcome(noList, [], ["Excel"], [], "").note));
  const fn2 = fake([model([summary], ["Kubernetes"])]);
  check("the draft returns the skills note", /left Kubernetes out/.test((await draft(input, fn2.client)).skillsNote));

  // ---------- A claim phrased differently from the requirement ----------
  const reqs = ["Own the programme budget and report on financial performance"];
  check("a distinctive word of an unshown requirement is found when the line uses it", unshownRequirementWords("Tracked the programme budget alongside delivery.", reqs, CV).join() === "budget");
  check("a word the CV, an answer or the notes already use is fine", unshownRequirementWords("Tracked the programme budget.", reqs, `${CV}\nI reported on part of the programme budget.`).length === 0);
  check("a different ending counts as the same word", unshownRequirementWords("Tracked budgets.", reqs, CV).join() === "budget");
  check("generic words and short words are never a signal", unshownRequirementWords("Led delivery and reporting with strong management of the team.", reqs, CV).length === 0);
  const flagged = run([summary, ch({ sourceBulletId: "B5", newText: "Led the portal migration and tracked the programme budget.", evidenceQuote: "Led delivery of a customer portal migration" })], { answers: [] });
  check("a line that claims it in other words is kept but flagged amber, naming the word", byId(flagged, "B5")?.verification === "check" && /"budget"/.test(byId(flagged, "B5")?.issues.join(" ") ?? ""));
  const confirmed = run([summary, ch({ sourceBulletId: "B5", newText: "Led the portal migration and tracked part of the programme budget.", source: "Answer 1", evidenceQuote: "I tracked the programme budget alongside delivery, partly" })]);
  check("the same line is not flagged once an answer confirms it", byId(confirmed, "B5")?.verification === "supported");

  // ---------- Bullet IDs never reach the reader ----------
  check("prompt: never write a bullet ID in any text", /Never write a bullet ID/.test(DRAFT_PROMPT));
  const fid = fake([model([ch({ sourceBulletId: "B5", newText: "Led the portal migration across three teams.", evidenceQuote: "Led delivery of a customer portal migration", whatChanged: "Moves B5 up (B6)." })])], (ids) => ({ verdicts: ids.map((id) => ({ id, supported: id !== "B5", unsupportedClaims: id === "B5" ? ["B5 adds a claim"] : [] })) }));
  const rid = await draft(input, fid.client);
  const lineB5 = rid.changes.find((c) => c.id === "B5");
  check("an ID in the explanation or the fact-checker's reason is removed", !!lineB5 && !/\bB\d+\b/.test(`${lineB5.whatChanged} ${lineB5.issues.join(" ")}`));

  // ---------- Lines the user put back ----------
  const keepCheck = run([summary, led]);
  void keepCheck;
  const kept = checkDraft([summary, led], { cv: CV, jd: JD, notes: "", answers, context, bullets, hasFeedback: true, keepOriginal: ["B5"] });
  check("a line the user put back is never changed again", !kept.changes.some((c) => c.id === "B5") && kept.rejections.length === 0);
  const keptSum = checkDraft([summary], { cv: CV, jd: JD, notes: "", answers, context, bullets, hasFeedback: true, keepOriginal: ["B3"] });
  check("a summary the user put back is not re-added", !keptSum.changes.some((c) => c.id === "B3"));
  const fk = fake([model([summary, led])]);
  const rk = await draft({ ...input, previous: [{ id: "B5", action: "reword", newText: "Led the migration." }], feedback: "Make it shorter", keepOriginal: ["B5"] }, fk.client);
  check("a rework tells the model which lines to leave exactly as they are", /put back to their original wording/.test(fk.draftCalls[0].messages[0].content) && fk.draftCalls[0].messages[0].content.includes("- B5: Led delivery of a customer portal migration"));
  check("and ignores any change to them", !rk.changes.some((c) => c.id === "B5"));

  // ---------- Bad output ----------
  const bad = fake(["not json", "still not json"]);
  let e1: AnalysisError | null = null;
  try {
    await draft(input, bad.client);
  } catch (e) {
    e1 = e as AnalysisError;
  }
  check("invalid draft: exactly one retry, then an error, and no fact-check", bad.draftCalls.length === 2 && e1?.status === 502 && bad.checkCalls.length === 0);
  const recover = fake(["not json", model([summary])]);
  const rc = await draft(input, recover.client);
  check("the retry can recover", recover.draftCalls.length === 2 && rc.changes.length >= 1);
  const tooMany = fake([model(Array(20).fill(led))]);
  const rt = await draft(input, tooMany.client);
  check("an over-long list is trimmed, not rejected", rt.changes.length >= 1);
  let empty: AnalysisError | null = null;
  try {
    await draft({ ...input, cv: "  " }, fake([model([])]).client);
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
