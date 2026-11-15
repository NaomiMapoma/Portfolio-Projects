// Runs a sample CV and job description through the analysis engine and prints
// the result plus token counts. Needs ANTHROPIC_API_KEY in .env.local.
//
// Run: npx tsx --env-file=.env.local scripts/analyse-sample.ts

import { analyse } from "../lib/claude";
import { quoteIn } from "../lib/bullets";
import { containsTerm } from "../lib/keywords";
import { invalidNumbers } from "../lib/rewrites";

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

EDUCATION
BA Business Studies, Example University, 2012 to 2015

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
- Experience managing programme budgets
- PRINCE2 or equivalent qualification`;

async function main() {
  const { result, usage, dropped } = await analyse(CV, JD);

  console.log(JSON.stringify(result, null, 2));
  console.log("\nToken counts (analysis plus fact-check):", usage);
  console.log("Dropped by code checks:", dropped);

  // Every number in a rewrite must be in the original bullet or inside a [placeholder].
  const badNumbers = result.rewrites.flatMap((r) => [
    ...invalidNumbers(r.original, r.lightTouch),
    ...invalidNumbers(r.original, r.strongerImpact),
  ]);
  const flagged = result.rewrites.filter((r) => r.verification !== "supported").length;
  console.log(
    `\nRewrites: ${result.rewrites.length} (${flagged} flagged "Check this claim"), invented numbers found: ${badNumbers.length}`,
  );
  if (badNumbers.length) {
    console.log("INVENTED NUMBERS:", badNumbers);
    process.exit(1);
  }

  console.log("\nKeywords present:", result.keywords.present);
  console.log("Keywords to add truthfully:", result.keywords.addTruthfully.map((a) => a.keyword));
  console.log("Keyword gaps:", result.keywords.gaps);
  const leaked = result.rewrites.filter((r) =>
    result.keywords.gaps.some((g) => containsTerm(`${r.lightTouch} ${r.strongerImpact}`, g) && !containsTerm(r.original, g)),
  );
  console.log(`Gap keywords leaked into rewrites: ${leaked.length}`);
  if (leaked.length) process.exit(1);

  const quotes = [
    ...result.strengths.map((s) => s.evidenceQuote),
    ...result.gaps.map((g) => g.evidenceQuote).filter(Boolean),
    ...result.achievements.emphasise.map((e) => e.evidenceQuote),
    ...result.keywords.addTruthfully.map((a) => a.evidenceQuote),
  ];
  const missing = quotes.filter((q) => !quoteIn(CV, q));
  console.log(`\nEvidence quotes found in the CV: ${quotes.length - missing.length}/${quotes.length}`);
  if (missing.length) {
    console.log("MISSING:", missing);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
