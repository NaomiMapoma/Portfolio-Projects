// Live check of the guided flow against the real Claude API, on a fictional CV and job (never a real CV). It runs the
// assessment, answers the questions, drafts, and checks the honesty rules on what really came back. It costs a few
// pence (about 12,000 tokens). Needs ANTHROPIC_API_KEY in .env.local.
//
// Run: npm run test:live

import { assess } from "../lib/assess";
import { draft } from "../lib/draft";
import { containsTerm } from "../lib/keywords";
import { invalidNumbers } from "../lib/numbers";

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
- Introduced agile ways of working to the digital team

Business Analyst, Sample Services, 2016 to 2019
- Gathered requirements from stakeholders for internal reporting tools
- Produced weekly management reports

Retail Assistant, High Street Books, 2012 to 2016
- Served customers and handled the till
- Helped to arrange window displays

SKILLS
Stakeholder management, agile delivery, risk and issue tracking, Excel`;

const JD = `Senior Programme Manager

About Northbridge Digital
Northbridge Digital is a public body that builds online services for residents and local businesses.

THE ROLE
We are looking for a Senior Programme Manager to lead a portfolio of digital transformation programmes.

WHAT YOU WILL DO
- Lead delivery of complex, cross-functional programmes to time and budget
- Own the programme budget and report on financial performance
- Manage senior stakeholders and run steering groups
- Use Jira to plan and track delivery

WHAT WE HAVE ASKED FOR
- Experience of agile delivery in a large organisation
- Strong stakeholder management skills
- PRINCE2 or equivalent qualification`;

const NOTES = "I built a small web app that tailors a CV to a job description. It works and I use it most weeks.";

async function main() {
  console.log("Assessment…");
  const a = await assess(CV, JD, NOTES);
  const as = a.assessment;
  check("a score between 0 and 100", as.score >= 0 && as.score <= 100);
  check("there are strengths, and each one has a verified quote", as.strengths.length > 0 && as.strengths.every((s) => s.evidenceQuote.length > 0));
  check("Jira and PRINCE2 are never shown as on the CV", as.requirements.filter((r) => /jira|prince2/i.test(r.requirement)).every((r) => r.status !== "yes"));
  check("there are between 1 and 5 questions, each saying what happens if skipped", as.questions.length >= 1 && as.questions.length <= 5 && as.questions.every((q) => q.ifSkipped.length > 0));
  const shownText = [as.scoreReason, ...as.strengths.map((x) => `${x.label} ${x.text}`), ...as.gaps.map((x) => `${x.label} ${x.text}`), ...as.plan.map((x) => `${x.label} ${x.text}`), ...as.questions.map((x) => `${x.text} ${x.ifSkipped}`)].join(" ");
  check("no internal bullet ID appears in any text the reader sees", !/\bB\d+\b/.test(shownText));
  check("the plan only uses the four known actions", as.plan.every((p) => ["reword", "reorder", "shorten", "cut"].includes(p.action)));
  console.log(`  score ${as.score}, ${as.strengths.length} strengths, ${as.gaps.length} gaps, ${as.requirements.length} requirements, ${as.plan.length} plan bullets, ${as.questions.length} questions`);
  console.log(`  tokens: ${a.usage.input} in, ${a.usage.output} out, ${a.usage.cacheRead} cache read, ${a.usage.cacheWrite} cache written`);

  // Answer the first two questions, skip the rest.
  const answers = as.questions.slice(0, 2).map((q, i) => ({
    id: q.id,
    question: q.text,
    answer: i === 0 ? "I reported on part of the programme budget, around 2 million, for the portal migration." : "I used Jira at Example Council to plan sprints.",
  }));

  console.log("Draft…");
  const d = await draft({ cv: CV, jd: JD, notes: NOTES, answers, context: { roleContext: as.roleContext, voice: as.voice, plan: as.plan, requirements: as.requirements } });
  const evidence = `${CV}\n${answers.map((x) => x.answer).join("\n")}\n${NOTES}`;
  const text = d.changes.map((c) => c.newText).join("\n");
  check("the summary is always in the draft", d.changes.some((c) => c.kind === "summary"));
  check("no placeholder anywhere", !/\[[^\]]*\]/.test(text));
  check("no figure that is not in the CV, the answers or the notes", invalidNumbers(evidence, text).length === 0);
  check("PRINCE2 is never claimed (nothing confirms it)", !containsTerm(text, "PRINCE2"));
  check("skills and name lines are never rewritten by the model", d.changes.filter((c) => c.kind !== "summary" && c.kind !== "skills").every((c) => !/^Jane Sample|^Stakeholder management,/.test(c.original)));
  check("no internal bullet ID in the explanations", !/\bB\d+\b/.test(d.changes.map((c) => `${c.whatChanged} ${c.issues.join(" ")}`).join(" ")));
  check("every reorder is an exact reordering of one role (code-verified)", d.moves.every((m) => m.ids.length === m.original.length && [...m.ids].sort().join() === [...m.original].sort().join()));
  check("every kept line names a source", d.changes.every((c) => c.action === "cut" || c.kind === "skills" || c.source.length > 0));
  check("every line the fact-check could not support is shown amber, not hidden", d.changes.every((c) => c.verification === "supported" || c.issues.length > 0));
  console.log(`  ${d.changes.length} changes (${d.changes.filter((c) => c.verification === "check").length} amber), ${d.rejections.length} removed`);
  for (const r of d.rejections) console.log(`  removed: ${r.label}: ${r.reason}`);
  console.log(`  tokens (draft + fact-check): ${d.usage.input} in, ${d.usage.output} out, ${d.usage.cacheRead} cache read`);

  if (failed) {
    console.log(`\n${failed} check(s) failed. Read each FAIL: it is a real bug, model behaviour, or a mistake in the check.`);
    process.exit(1);
  }
  console.log("\nAll live checks passed");
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : "The live check failed.");
  process.exit(1);
});
