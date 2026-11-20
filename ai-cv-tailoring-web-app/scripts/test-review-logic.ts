// Offline checks for the review screen's word differences, the summary sector check, the skills line with brackets,
// and Word line breaks. No API calls. Run: npx tsx scripts/test-review-logic.ts

import JSZip from "jszip";
import { wordDiff } from "../components/wordDiff";
import { DRAFT_PROMPT, appendedOnly, dropOffSectorClauses, matchTypography, unusedInputs } from "../lib/draft";
import type { DraftChange } from "../lib/draft-types";
import { readFileSync } from "node:fs";
import { applySkills, planFrontMoves } from "../lib/skills-line";
import { parseCvFile } from "../lib/cv-text";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// ---------- Word differences ----------
{
  const same = wordDiff("Led a team of five.", "Led a team of five.");
  check("identical lines show no change", same.original.every((p) => p.kind === "same" && !p.mark) && same.next.every((p) => p.kind === "same" && !p.mark));

  const comma = wordDiff("across Meta, TikTok LinkedIn and Reddit", "across Meta, TikTok, LinkedIn and Reddit");
  check("a word that only gained a comma is not struck through", comma.original.every((p) => p.kind === "same"));
  check("only the new comma is marked", comma.next.filter((p) => p.mark).length === 1 && comma.next.find((p) => p.mark)?.mark === ",");

  const dropped = wordDiff("Led a team of five.", "Led a team.");
  check("a word that is really gone is removed", dropped.original.some((p) => p.kind === "removed" && /five/.test(p.text)));

  const cased = wordDiff("Led Tiktok campaigns", "led TikTok campaigns");
  check("capitals do not count as a change", cased.original.every((p) => p.kind === "same") && cased.next.every((p) => p.kind === "same"));

  const moved = wordDiff("Managed budgets and a team of five", "A team of five, and managed budgets");
  check("words that only moved are marked moved, never removed", !moved.original.some((p) => p.kind === "removed") && moved.original.some((p) => p.kind === "moved"));

  // No word may be struck through if it still appears in the new line.
  const cases: [string, string][] = [
    ["Owned end-to-end B2B & B2C paid social operations across Meta, TikTok LinkedIn and Reddit", "Owned end-to-end B2B & B2C paid social operations across Meta, TikTok, LinkedIn and Reddit"],
    ["Led the redesign of measurement, including attribution.", "Led the redesign of measurement including attribution"],
    ["Built frameworks across creative, audiences, bidding and measurement.", "Built experimentation frameworks across creative, audiences and bidding."],
  ];
  const clean = cases.every(([a, b]) => {
    const d = wordDiff(a, b);
    const newWords = new Set(b.toLowerCase().replace(/[^\p{L}\p{N}£$€%&+\s]/gu, "").split(/\s+/));
    return d.original.filter((p) => p.kind === "removed").every((p) => !newWords.has(p.text.toLowerCase().replace(/[^\p{L}\p{N}£$€%&+]/gu, "")));
  });
  check("no struck-through word is still in the new line", clean);
  const apos = wordDiff("Led AMEX\u2019s merchant acquisition", "Led AMEX's merchant acquisition");
  check("a curly and a straight apostrophe are the same word", apos.original.every((p) => p.kind === "same" && !p.mark) && apos.next.every((p) => p.kind === "same" && !p.mark));
  const rebuilt = wordDiff("one two three", "one three four");
  check("the original side always rebuilds to the original words", rebuilt.original.map((p) => p.text).join(" ") === "one two three");
}

// ---------- Typography ----------
{
  const orig = "Led AMEX\u2019s merchant acquisition";
  check("a straight apostrophe is turned back into the CV's curly one", matchTypography(orig, "Led AMEX's merchant acquisition") === orig);
  check("a swap that only changes the apostrophe is then identical to the original", matchTypography(orig, "Led AMEX's merchant acquisition") === orig.trim());
  check("a CV with straight apostrophes is left alone", matchTypography("Led AMEX's work", "Led AMEX's work") === "Led AMEX's work");
  check("curly double quotes are matched too", matchTypography("Won \u201Cbest\u201D award", 'Won "best" award') === "Won \u201Cbest\u201D award");
}

// ---------- Answers and notes woven in ----------
{
  const orig = "Led paid social for a global brand across five business units.";
  check("an answer stuck on the end of a line is spotted", appendedOnly(orig, "Led paid social for a global brand across five business units, and line managed two direct reports."));
  check("a rewrite that works the fact into the sentence is not flagged", !appendedOnly(orig, "Line managed two direct reports while leading paid social for a global brand across five business units."));
  check("a tiny trailing change is not flagged", !appendedOnly(orig, "Led paid social for a global brand across five business units today."));
  check("the same line with only its full stop removed is not flagged", !appendedOnly(orig, "Led paid social for a global brand across five business units"));

  const change = (over: Partial<DraftChange>): DraftChange => ({ id: "B8", action: "reword", original: orig, newText: orig, whatChanged: "", source: "CV", evidenceQuote: "", verification: "supported", issues: [], ...over });
  const answers = [{ id: "Q1", question: "Did you manage people?", answer: "Yes, I line managed two marketing managers and ran their development reviews every quarter." }];
  const used = change({ newText: "Line managed two marketing managers while leading paid social for a global brand across five business units.", source: "Answer 1" });
  check("an answer a change cites is counted as used", unusedInputs(answers, "", [used]).length === 0);
  const usedUncited = change({ newText: "Led paid social for a global brand across five business units and ran quarterly development reviews for two marketing managers." });
  check("an answer whose wording appears in a new line is counted as used even if not cited", unusedInputs(answers, "", [usedUncited]).length === 0);
  const notUsed = unusedInputs(answers, "", [change({ newText: "Led paid social across five business units for a global brand." })]);
  check("an answer nothing used gets a plain note", notUsed.length === 1 && /question 1 wasn't used/.test(notUsed[0]));
  check("a short answer never causes a note", unusedInputs([{ id: "Q2", question: "Used Jira?", answer: "No, never." }], "", []).length === 0);
  check("notes that nothing used get a note", unusedInputs([], "I ran quarterly planning workshops for the whole marketing department and their agency partners.", []).length === 1);
  check("a reverted change does not count as using an answer", unusedInputs(answers, "", [used], new Set(["B8"])).length === 1);

  check("the prompt tells the model to work answers into the sentence, not add them on", /Using the candidate's answers and notes/.test(DRAFT_PROMPT) && /Never add it as a trailing clause/.test(DRAFT_PROMPT) && /most relevant bullet/.test(DRAFT_PROMPT));
  check("the prompt lets the summary use answers and notes", /answers and their notes, and never a fact that only the job description states/.test(DRAFT_PROMPT) && !/adding no name, number, outcome or claim it does not already state/.test(DRAFT_PROMPT));
  check("the fact-check lets a summary use facts from answers and notes", /may use facts that are stated in the candidate's answers or notes/.test(readFileSync(new URL("../lib/factcheck.ts", import.meta.url), "utf8")));
}

// ---------- Summary sector check ----------
{
  const t = "Performance marketing lead with 8 years of experience. Worked across Brand, Data and Engineering teams, with FCA financial promotion experience.";
  check("an arts job drops the FCA clause", !/FCA/.test(dropOffSectorClauses(t, "We sell limited-edition prints to collectors.")));
  check("a bank job keeps it (words: bank, payments)", /FCA/.test(dropOffSectorClauses(t, "Join our business bank and payments team in London.")));
  check("a job that names FCA keeps it", /FCA/.test(dropOffSectorClauses(t, "You know FCA rules.")));
  check("the rest of the summary is untouched", dropOffSectorClauses(t, "Prints for collectors.").startsWith("Performance marketing lead with 8 years of experience."));
  check("a summary with no sector words is returned unchanged", dropOffSectorClauses("Marketing lead with 8 years of experience.", "Prints.") === "Marketing lead with 8 years of experience.");
}

// ---------- Skills lines ----------
{
  check("brackets with commas stay one item", applySkills("Reporting: GA4, Tableau, SQL (MySQL, PostgreSQL), Excel", [], ["SQL (MySQL, PostgreSQL)"]) === "Reporting: SQL (MySQL, PostgreSQL), GA4, Tableau, Excel");
  const cv = "Jane\n\nSKILLS\n\nPaid Media: Meta, TikTok, Reddit\n\nReporting: GA4, Tableau, SQL\n\nEXPERIENCE\n\n- Led a team";
  const moves = planFrontMoves(cv, ["Tableau", "Reddit"]);
  check("skills move to the front on every skills line that has one", moves.length === 2 && moves.every((m) => m.after !== m.before));
  check("no skill is lost or renamed", moves.every((m) => [...m.before.replace(/^[^:]*:\s*/, "").split(", ")].sort().join() === [...m.after.replace(/^[^:]*:\s*/, "").split(", ")].sort().join()));
}

// ---------- Word line breaks ----------
async function docxWithBreak(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const p = (inner: string) => `<w:p>${inner}</w:p>`;
  const r = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
  const body = [
    p(r("Naomi Example") + "<w:r><w:br/></w:r>" + r("Performance Marketing Lead")),
    p(r("PERSONAL SUMMARY")),
    p(r("Performance marketing lead with eight years of hands-on experience owning paid social acquisition for global brands, having managed large annual budgets across several markets.")),
    p(r("EXPERIENCE")),
    p(r("Led paid social for a global brand across five business units, forecasting and allocating a large annual budget with quarterly reviews.")),
  ].join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
(async () => {
  const text = await parseCvFile(await docxWithBreak(), "cv.docx");
  check("a Shift+Enter line break becomes a space, so words are not glued together", /Naomi Example Performance Marketing Lead/.test(text) && !/ExamplePerformance/.test(text));
  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
})();
