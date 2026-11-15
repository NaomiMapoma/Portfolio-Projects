// Runs a sample CV and job description through the cover letter engine and
// prints the letter, its checks and the token counts. Needs ANTHROPIC_API_KEY
// in .env.local.
//
// Run: npx tsx --env-file=.env.local scripts/letter-sample.ts

import { generateLetter } from "../lib/letter";

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

SKILLS
Stakeholder management, agile delivery, risk and issue tracking, Excel`;

const JD = `Senior Programme Manager

We are looking for a Senior Programme Manager to lead a portfolio of digital transformation programmes.

Responsibilities
- Lead delivery of complex, cross-functional programmes to time and budget
- Own the programme budget and report on financial performance
- Manage senior stakeholders and run steering groups
- Use Jira to plan and track delivery

Requirements
- Experience of agile delivery in a large organisation
- Strong stakeholder management skills
- PRINCE2 or equivalent qualification`;

async function main() {
  const out = await generateLetter({
    cv: CV,
    jd: JD,
    accepted: [],
    gapKeywords: ["Jira", "PRINCE2", "budget management"],
  });

  console.log(out.letter);
  console.log(`\n${out.wordCount} words`);
  console.log(`Verification: ${out.verification}`);
  if (out.issues.length) console.log("Issues:", out.issues);
  if (out.styleNotes.length) console.log("Style notes:", out.styleNotes);
  console.log("Token counts (letter plus fact-check):", out.usage);
  console.log("Fact-check call:", out.factCheckUsage ?? "skipped");

  if (/\b(jira|prince2)\b/i.test(out.letter)) {
    console.log("\nLEAK: the letter mentions a gap keyword.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
