// Offline checks for reordering the bullets of one role: finding runs, checking the model's order, and applying it.
// No API calls. Run: npx tsx scripts/test-moves.ts

import { splitCv } from "../lib/bullets";
import { applyDraft, orderKey } from "../lib/draft-apply";
import { findRuns, looksLikeRoleLine, planMoves } from "../lib/draft-moves";
import type { DraftChange, DraftMove } from "../lib/draft-types";
import { buildExport } from "../lib/export";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// A Word upload is read WITHOUT list markers, so none of these bullets has one.
const CV = `Jane Sample
Programme Manager

PROFILE
Programme manager with experience delivering digital change across public sector teams.

EXPERIENCE
Programme Manager, Example Council, 2019 to 2024
Led delivery of a customer portal migration across three teams
Presented fortnightly progress updates to the steering group
Managed a team of six analysts and developers

Business Analyst, Sample Services, 2016 to 2019
Gathered requirements from stakeholders for internal reporting tools
Produced weekly management reports

Retail Assistant, High Street Books, 2012 to 2016
Served customers and handled the till

SKILLS
Stakeholder management, agile delivery, risk and issue tracking, Excel`;
// B1 Jane Sample, B2 Programme Manager, B3 profile, B4 role, B5 Led, B6 Presented, B7 Managed, B8 role, B9 Gathered, B10 Produced,
// B11 role, B12 Served, B13 skills.
const { bullets } = splitCv(CV);
const id = (start: string) => bullets.find((b) => b.text.startsWith(start))!.id;
check("the sample's ids are what the tests expect", id("Led") === "B5" && id("Presented") === "B6" && id("Managed") === "B7" && id("Gathered") === "B9");

// ---------- Runs ----------
check("a role line is recognised by its dates, a list item is not", looksLikeRoleLine("Programme Manager, Example Council, 2019 to 2024", "") && !looksLikeRoleLine("Led delivery in 2021 of a portal", "-") && !looksLikeRoleLine("Led delivery of a customer portal migration across three teams", ""));
const runs = findRuns(CV);
check("each role with two or more bullets is a run, without needing list markers", runs.map((r) => r.ids.join()).join("|") === "B5,B6,B7|B9,B10");
check("a run remembers the role line above it", runs[0].label.startsWith("Programme Manager, Example Council") && runs[1].label.startsWith("Business Analyst"));
check("a role with a single bullet is not a run", !runs.some((r) => r.ids.includes("B12")));
check("the summary, skills line and name lines are never in a run", !runs.some((r) => r.ids.some((i) => ["B1", "B2", "B3", "B13"].includes(i))));
check("role lines are never in a run", !runs.some((r) => r.ids.some((i) => ["B4", "B8", "B11"].includes(i))));
check("a CV with list markers gives the same runs", findRuns(CV.replace(/^(Led|Presented|Managed|Gathered|Produced)/gm, "- $1")).map((r) => r.ids.join()).join("|") === "B5,B6,B7|B9,B10");

// A Word upload has a blank line between EVERY paragraph. That must not hide the runs (found on a real extraction).
const wordLike = CV.split("\n").filter((l) => l.trim()).join("\n\n");
check("blank lines between every paragraph (a Word upload) do not break the runs", findRuns(wordLike).map((r) => r.ids.join()).join("|") === "B5,B6,B7|B9,B10");
check("in Word-like text the dated role lines still separate the roles", findRuns(wordLike).length === 2);
// Roles with no dates, in pasted text: blank lines between roles separate them.
const undated = "Jane\n\nEXPERIENCE\nProgramme Manager, Example Council\nLed the migration\nPresented updates\n\nBusiness Analyst, Sample Services\nGathered requirements\nProduced reports";
// Undated role lines are not recognised as role lines, so they sit inside their run and a reorder that (correctly) leaves
// the role line out is refused. That is the safe failure: nothing moves.
check("in pasted text with undated roles, a blank line between roles still separates them into two runs", findRuns(undated).length === 2 && findRuns(undated)[0].ids.join() === "B2,B3,B4");
check("a reorder that leaves out an undated role line is refused rather than guessed", planMoves(undated, ["B4,B3"], new Set()).moves.length === 0);

// ---------- Checking the model's order ----------
const none = new Set<string>();
const ok = planMoves(CV, ["B7,B5,B6|Leads with the team and delivery"], none);
check("a clean permutation of one role is kept, with its reason", ok.moves.length === 1 && ok.moves[0].ids.join() === "B7,B5,B6" && ok.moves[0].original.join() === "B5,B6,B7" && ok.moves[0].whatChanged === "Leads with the team and delivery" && ok.rejections.length === 0);
check("without a reason it still gets a plain one", planMoves(CV, ["B6,B5,B7"], none).moves[0].whatChanged.length > 10);
check("two roles can each be reordered", planMoves(CV, ["B6,B5,B7", "B10,B9"], none).moves.length === 2);
check("the same order is not a move", planMoves(CV, ["B5,B6,B7"], none).moves.length === 0 && planMoves(CV, ["B5,B6,B7"], none).rejections.length === 0);
const left = planMoves(CV, ["B6,B5"], none);
check("an order that leaves a line out is refused", left.moves.length === 0 && left.rejections.some((r) => /left out, repeated or mixed/.test(r.reason)));
check("an order that repeats a line is refused", planMoves(CV, ["B6,B6,B5"], none).moves.length === 0);
check("an order that mixes two roles is refused", planMoves(CV, ["B5,B9,B6,B7"], none).moves.length === 0);
check("an order naming the role line is refused", planMoves(CV, ["B4,B5,B6,B7"], none).moves.length === 0);
check("an order naming the skills line or summary is refused", planMoves(CV, ["B13,B3"], none).moves.length === 0 && planMoves(CV, ["B3,B13"], none).rejections.length === 1);
check("an unknown id is refused", planMoves(CV, ["B99,B5"], none).moves.length === 0);
const withCut = planMoves(CV, ["B7,B5,B6"], new Set(["B6"]));
check("an order that includes a cut line is refused", withCut.moves.length === 0 && withCut.rejections.some((r) => /also being cut/.test(r.reason)));
check("a role the user put back to its original order is skipped", planMoves(CV, ["B7,B5,B6"], none, new Set(["B5"])).moves.length === 0);
check("two entries for one role: only the first counts", planMoves(CV, ["B7,B5,B6", "B6,B7,B5"], none).moves.length === 1);
check("ids with spaces and a one-line entry are tolerated", planMoves(CV, [" B7 , B5 ,B6 "], none).moves.length === 1 && planMoves(CV, [""], none).moves.length === 0 && planMoves(CV, ["B5"], none).moves.length === 0);

// ---------- Applying a move ----------
const move: DraftMove = ok.moves[0];
const reword = (idv: string, newText: string): DraftChange => ({ id: idv, action: "reword", original: bullets.find((b) => b.id === idv)!.text, newText, whatChanged: "x", source: "CV", evidenceQuote: "", verification: "supported", issues: [] });
const cutChange = (idv: string): DraftChange => ({ ...reword(idv, ""), action: "cut" });
const text = (idv: string) => bullets.find((b) => b.id === idv)!.text;
const by = (a: ReturnType<typeof applyDraft>) => Object.fromEntries(a.map((x) => [x.id, x.text]));

const applied = by(applyDraft([], [move], {}, bullets));
check("each position takes the text of the line now placed there", applied.B5 === text("B7") && applied.B6 === text("B5") && applied.B7 === text("B6"));
check("a move changes only that role", Object.keys(applied).sort().join() === "B5,B6,B7");
const both = by(applyDraft([reword("B5", "Led the portal migration across three teams.")], [move], {}, bullets));
check("a line that is reworded AND moved carries its new wording to its new position", both.B6 === "Led the portal migration across three teams." && both.B5 === text("B7") && both.B7 === text("B6"));
const revertedWord = by(applyDraft([reword("B5", "Led the portal migration across three teams.")], [move], { B5: true }, bullets));
check("putting a reworded line back means its original travels instead", revertedWord.B6 === text("B5"));
check("'use my original order' cancels the move but keeps rewording", (() => { const r = by(applyDraft([reword("B5", "Led it.")], [move], { [orderKey(move)]: true }, bullets)); return Object.keys(r).join() === "B5" && r.B5 === "Led it."; })());
check("a move with a cut line in its role is not applied", applyDraft([cutChange("B6")], [move], {}, bullets).every((a) => a.id === "B6" && a.remove));
check("a cut is still applied on its own", applyDraft([cutChange("B10")], [], {}, bullets).length === 1);
check("a reword equal to the original is not an application", applyDraft([reword("B5", text("B5"))], [], {}, bullets).length === 0);

// ---------- Through the exports ----------
const exported = buildExport(CV, applyDraft([], [move], {}, bullets));
const lines = exported.plainText.split("\n");
const at = (t: string) => lines.findIndex((l) => l.includes(t));
check("the plain text now has the role's bullets in the new order, and the role line stays above them", at("Managed a team") < at("Led delivery") && at("Led delivery") < at("Presented fortnightly") && at("Programme Manager, Example Council") < at("Managed a team"));
check("nothing else in the CV moved", at("Business Analyst") > at("Presented fortnightly") && at("Gathered requirements") < at("Produced weekly") && lines.at(-1)!.startsWith("Stakeholder management"));
check("each moved position is one change for the Word export", exported.changes.length === 3 && exported.changes.every((c) => !c.remove));
check("moved lines are marked as changed in the preview", exported.lines.filter((l) => l.state === "changed").length === 3);

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
