// Offline checks for the shared building blocks: splitting the CV into bullets, quote and number checks, and term
// matching. No API calls. Run: npx tsx scripts/test-core.ts

import { formatForPrompt, parseCv, quoteIn, quoteInBullet, sectionKind, splitCv, stripBulletIds } from "../lib/bullets";
import { containsStem, containsTerm, employerWords, jdOnlyTerms, mentionsGapKeyword } from "../lib/keywords";
import { invalidNumbers } from "../lib/numbers";

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
// B1 Jane Sample, B2 Programme Manager..., B3 Led delivery, B4 Presented, B5 Managed, B6 Stakeholder...

// ---------- Bullet splitting and quotes ----------
const { bullets } = splitCv(CV);
check("headings are not bullets", !bullets.some((b) => b.text === "EXPERIENCE" || b.text === "SKILLS"));
check("list markers are stripped", bullets.some((b) => b.text.startsWith("Led delivery")));
check("ids are sequential", bullets.map((b) => b.id).join() === bullets.map((_, i) => `B${i + 1}`).join());
check("the prompt text has the section and the id", formatForPrompt(bullets).includes("## EXPERIENCE") && formatForPrompt(bullets).includes("B3:"));
check("B3 is the delivery bullet", bullets.find((b) => b.id === "B3")?.text.startsWith("Led delivery") === true);
check("a quote matches despite case and spacing", quoteIn(CV, "led  DELIVERY of a customer portal"));
check("a made-up quote does not match", !quoteIn(CV, "Managed a 50 million pound budget"));
check("an empty quote never matches", !quoteIn(CV, ""));
check("a quote must be in the cited bullet", quoteInBullet(bullets, "B3", "customer portal migration") && !quoteInBullet(bullets, "B4", "customer portal migration") && !quoteInBullet(bullets, "B99", "anything"));
check("parseCv and splitCv agree on ids", parseCv(CV).flatMap((l) => (l.kind === "bullet" ? [l.id] : [])).join() === bullets.map((b) => b.id).join());

// ---------- Bullet IDs never reach the reader ----------
check("a bracketed ID is removed", stripBulletIds("Put the migration bullet (B8) first") === "Put the migration bullet first" && stripBulletIds("Lead with these (B7, B8) and (B9 and B10).") === "Lead with these and.");
check("a bare ID becomes 'that line', two become 'those lines'", stripBulletIds("Move B8 up") === "Move that line up" && stripBulletIds("Put B7 and B8 first") === "Put those lines first" && stripBulletIds("Keep B7, B8 and B9 together") === "Keep those lines together");
check("ordinary text is left alone", stripBulletIds("Reword the summary. Budget B2B sales in Q3 and 2024.") === "Reword the summary. Budget B2B sales in Q3 and 2024.");

// ---------- Sections ----------
check("section kinds are recognised", sectionKind("PERSONAL SUMMARY") === "summary" && sectionKind("Profile") === "summary" && sectionKind("TECHNICAL SKILLS") === "skills" && sectionKind("EXPERIENCE") === "other");
check(
  "summary headings in normal case are recognised, not only ALL CAPS",
  ["Professional Summary", "Personal Profile", "About Me", "Executive Summary"].every((h) => {
    const b = splitCv(`Casey Sample\n\n${h}\nPerformance marketer with 8 years of experience.\n\nExperience\n- Managed budgets`).bullets;
    return b.some((x) => sectionKind(x.section) === "summary" && /Performance marketer/.test(x.text));
  }),
);
const headingless = splitCv("Casey Sample\ncasey@example.com\n\nPerformance marketer with eight years of experience running paid social campaigns for financial and retail brands, focused on testing, reporting and budget control across several channels and teams.\n\nEXPERIENCE\n- Managed budgets").bullets;
check("a summary with no heading is found, and a contact line is never chosen", headingless.some((x) => sectionKind(x.section) === "summary" && /Performance marketer/.test(x.text)) && !headingless.some((x) => sectionKind(x.section) === "summary" && /@/.test(x.text)));
check("a list of skills lines is recognised as a skills section", splitCv("Casey\n\nSKILLS\nPaid Media: Meta Ads Manager, TikTok Ads Manager\nReporting: GA4").bullets.filter((b) => sectionKind(b.section) === "skills").length === 2);

// ---------- Number check ----------
const orig = "Managed a team of 6 analysts and cut reporting time by 20% in 2023, saving 1,000 hours";
check("numbers already in the original are allowed", invalidNumbers(orig, "Managed 6 analysts, cutting time by 20% in 2023").length === 0);
check("comma-normalised numbers match", invalidNumbers(orig, "Saved 1000 hours").length === 0);
check("an invented number is rejected", invalidNumbers(orig, "Cut reporting time by 40%").join() === "40");
check("digits inside a [placeholder] are not counted", invalidNumbers(orig, "Cut time by [25%] across [3 teams]").length === 0);
check("a placeholder does not excuse a number outside it", invalidNumbers(orig, "Cut time by 40% to [X%]").join() === "40");
check("no numbers means nothing to reject", invalidNumbers("Led a team", "Led the team and improved results").length === 0);
check("a number written as a word allows the digit form", invalidNumbers("Eight years in paid social", "8 years in paid social").length === 0 && invalidNumbers("Eight years in paid social", "9 years").length === 1);
check("the same figure in another notation is the same figure", ["£5M+", "£5+ million", "5 million", "£5,000,000", "5mn"].every((v) => invalidNumbers("Owned a £5M+ budget", `Owned ${v}`).length === 0));
check("a different amount is still different", invalidNumbers("Owned a £5M budget", "Owned £6M").length === 1 && invalidNumbers("Owned a £5M budget", "Owned £50k").length === 1);

// ---------- Term matching ----------
check("containsTerm is whole-word and case-insensitive", containsTerm("Used JavaScript daily", "javascript") && !containsTerm("Used JavaScript daily", "Java"));
check("containsStem accepts a different word ending", containsStem("Presented fortnightly updates", "present") && containsStem("Trained two starters", "train"));
check("containsStem does not match a different word", !containsStem("Used JavaScript daily", "java") && !containsStem("Led a team", "lead a team of ten"));
check("mentionsGapKeyword finds a gap term the CV does not show", mentionsGapKeyword("I used Jira daily", ["Jira", "agile"], "Led agile delivery").join() === "Jira");

// ---------- Names the job uses that the CV never does ----------
const JD = `Senior Programme Manager

About Northbridge Digital
Northbridge Digital builds online services.

THE ROLE
WHAT YOU WILL DO
- Use Jira to plan delivery. A PRINCE2 qualification helps. The role has a steering group.
Editions
- Run steering groups`;
const terms = jdOnlyTerms(JD, CV);
check("a tool and a qualification the CV never names are found", terms.includes("Jira") && terms.includes("PRINCE2"));
check("ALL-CAPS headings and ordinary words are not mistaken for tools", !terms.some((t) => ["THE", "ROLE", "WHAT", "YOU", "WILL", "DO"].includes(t)));
check("a name the CV does name is not listed", !jdOnlyTerms("Use Jira daily", "Ran Jira boards").includes("Jira"));
check("the employer's name is recognised as the employer, not a tool", employerWords(JD).has("northbridge") && !employerWords(JD).has("jira"));

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
