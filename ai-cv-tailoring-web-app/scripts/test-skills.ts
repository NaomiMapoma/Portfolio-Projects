// Offline checks for adding keywords to the skills line (no API calls).
// Run: npx tsx scripts/test-skills.ts

import { applySkills, planSkills } from "../lib/skills-line";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

check("comma list: keyword appended", applySkills("Excel, SQL, Power BI", ["Reporting"], []) === "Excel, SQL, Power BI, Reporting");
check("semicolon list keeps its separator", applySkills("Excel; SQL; Power BI", ["Reporting"], []) === "Excel; SQL; Power BI; Reporting");
check("pipe list keeps its separator", applySkills("Excel | SQL | Power BI", ["Reporting"], []) === "Excel | SQL | Power BI | Reporting");
check("label is kept", applySkills("Skills: Excel, SQL", ["Reporting"], []) === "Skills: Excel, SQL, Reporting");
check("trailing full stop is kept at the end", applySkills("Excel, SQL.", ["Reporting"], []) === "Excel, SQL, Reporting.");
check("already present (any case): not added twice", applySkills("Excel, SQL, reporting", ["Reporting"], []) === "Excel, SQL, reporting");
check("a term inside another item counts as present", applySkills("Excel, risk and issue tracking", ["issue tracking"], []) === "Excel, risk and issue tracking");
check("two keywords: both added in order", applySkills("Excel, SQL", ["Reporting", "Onboarding"], []) === "Excel, SQL, Reporting, Onboarding");
check("duplicates among the keywords are added once", applySkills("Excel, SQL", ["Reporting", "reporting"], []) === "Excel, SQL, Reporting");
check("a capitalised list gets a capitalised keyword", applySkills("Excel, SQL, Power BI", ["stakeholder management"], []) === "Excel, SQL, Power BI, Stakeholder management");
check("a lower-case list keeps the keyword as given", applySkills("agile delivery, risk tracking", ["stakeholder management"], []) === "agile delivery, risk tracking, stakeholder management");

check("front skills move to the start", applySkills("Excel, SQL, Power BI", [], ["Power BI", "SQL"]) === "Power BI, SQL, Excel");
check("front matching ignores case, keeps the CV's wording", applySkills("Excel, SQL, Power BI", [], ["power bi"]) === "Power BI, Excel, SQL");
check("a front skill not on the line is ignored", applySkills("Excel, SQL", [], ["Jira"]) === "Excel, SQL");

// Never removes or renames an item.
const original = "Excel, SQL, Power BI, risk and issue tracking, agile delivery";
const out = applySkills(original, ["Reporting", "Excel"], ["agile delivery", "SQL"])!;
const items = (s: string) => s.split(",").map((i) => i.trim());
check("every original item is still there", items(original).every((i) => items(out).includes(i)));
check("only the verified keyword was added", items(out).length === items(original).length + 1);

check("not a list (one item): null", applySkills("Excel", ["Reporting"], []) === null);
check("a sentence is not a list: null", applySkills("Experienced in delivering large programmes, mostly in the public sector", ["Reporting"], []) === null);
check("brackets with commas are not split: null", applySkills("Excel (pivot, VLOOKUP", ["Reporting"], []) === null);
check("brackets with commas kept whole", applySkills("Excel (pivot tables, VLOOKUP), SQL", [], []) === null || applySkills("Excel (pivot tables, VLOOKUP), SQL", [], [])!.includes("(pivot tables, VLOOKUP)"));

// Planning against a whole CV.
const CV = `Jane Sample

EXPERIENCE
- Led delivery of a customer portal migration
- Produced weekly management reports

SKILLS
Stakeholder management, agile delivery, Excel`;
const plan = planSkills(CV, ["Reporting"], ["Excel"]);
check("plan finds the skills line", plan.status === "ready" && plan.before === "Stakeholder management, agile delivery, Excel");
check("plan builds the new line", plan.status === "ready" && plan.after === "Excel, Stakeholder management, agile delivery, Reporting");
check("plan lists what was added", plan.status === "ready" && plan.added.join() === "Reporting");
check("plan never touches non-skills bullets", plan.status === "ready" && plan.id === "B4");
check("nothing chosen: none", planSkills(CV, [], []).status === "none");
check("already everything there: none", planSkills(CV, ["agile delivery"], []).status === "none");
check("no skills section: no-line", planSkills("Jane\n\nEXPERIENCE\n- Led a team", ["Reporting"], []).status === "no-line");
check("skills as separate bullets (no list): no-line", planSkills("Jane\n\nSKILLS\n- Excel\n- SQL", ["Reporting"], []).status === "no-line");

if (failed > 0) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
