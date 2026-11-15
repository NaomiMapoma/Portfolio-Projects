// Offline checks for the CV export. No API calls, nothing written to disk.
// Run: npx tsx scripts/test-export.ts

import { readFileSync } from "node:fs";
import mammoth from "mammoth";
import { splitCv } from "../lib/bullets";
import { buildExport } from "../lib/export";
import { buildDocxBuffer } from "../lib/export-docx";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// Deliberately a bit messy: indentation, mixed markers, a blank-line gap, a line with no marker.
const CV = `Jane Sample
Programme Manager

PROFILE
Programme manager with experience delivering digital change.

EXPERIENCE
Programme Manager, Example Council, 2019 to 2024
- Led delivery of a customer portal migration across three teams
  • Presented fortnightly progress updates to the steering group
- Managed a team of 6 analysts and cut reporting time by 20%


SKILLS
Stakeholder management, agile delivery`;

async function main() {
  // ---------- splitCv IDs are unchanged by the refactor ----------
  const { bullets } = splitCv(CV);
  const byId = (id: string) => bullets.find((b) => b.id === id)?.text;
  check("splitCv ids and text are as before", byId("B1") === "Jane Sample" && byId("B3") === "Programme manager with experience delivering digital change." && byId("B6") === "Presented fortnightly progress updates to the steering group");
  check("sections are tracked", bullets.find((b) => b.id === "B5")?.section === "EXPERIENCE");

  // ---------- Nothing accepted: identical CV ----------
  const none = buildExport(CV, []);
  check("with nothing accepted the text is exactly the original", none.plainText === CV);
  check("with nothing accepted there are no changes", none.changes.length === 0);

  // ---------- Accepted rewrites change only their own lines ----------
  const accepted = [
    { id: "B5", text: "Led the customer portal migration across three teams, delivering it on time." },
    { id: "B7", text: "Managed 6 analysts and cut reporting time by 20% through a new weekly process." },
  ];
  const out = buildExport(CV, accepted);
  const origLines = CV.split("\n");
  const newLines = out.plainText.split("\n");
  check("same number of lines", origLines.length === newLines.length);
  const changedIdx = origLines.map((l, i) => (l !== newLines[i] ? i : -1)).filter((i) => i >= 0);
  check("only the two accepted bullets changed", changedIdx.length === 2);
  check("unaccepted lines (including the odd one with indent and bullet) are byte-for-byte unchanged", origLines.every((l, i) => changedIdx.includes(i) || l === newLines[i]));
  check("changed lines keep their original marker", newLines[changedIdx[0]].startsWith("- ") && newLines[changedIdx[1]].startsWith("- "));
  check("edited text is what is exported", out.plainText.includes("delivering it on time") && out.plainText.includes("through a new weekly process"));
  check("original wording of replaced bullets is gone", !out.plainText.includes("Led delivery of a customer portal migration across three teams"));
  check("changes list has before and after", out.changes.length === 2 && out.changes[0].before.startsWith("Led delivery") && out.changes[0].after.includes("on time"));
  check("nothing else is added", out.plainText.length < CV.length + 120 && !/keyword/i.test(out.plainText));

  // ---------- Edge cases ----------
  const edge = buildExport(CV, [
    { id: "B5", text: "   " }, // empty
    { id: "B7", text: "Managed a team of 6 analysts and cut reporting time by 20%" }, // unchanged
    { id: "B99", text: "Not a real bullet" },
  ]);
  check("empty, unchanged and unknown rewrites are skipped", edge.plainText === CV && edge.skipped.length === 3 && edge.changes.length === 0);

  const ph = buildExport(CV, [{ id: "B5", text: "Led the migration, cutting contacts by [X%]." }]);
  check("applied rewrites with [placeholders] are reported", ph.withPlaceholders.join() === "B5");
  const real = buildExport(CV, [{ id: "B5", text: "Led the migration, cutting contacts by 15%." }]);
  check("typing a real number over the placeholder clears the warning", real.withPlaceholders.length === 0);

  // ---------- DOCX round trip ----------
  const buffer = await buildDocxBuffer(out.lines);
  check("DOCX is a zip file", buffer[0] === 0x50 && buffer[1] === 0x4b);

  const raw = await mammoth.extractRawText({ buffer });
  const gotLines = raw.value.split("\n").map((l) => l.trim()).filter(Boolean);
  const expectedLines = out.lines.filter((l) => l.kind !== "blank").map((l) => l.text);
  check("DOCX text matches the export exactly, in order", JSON.stringify(gotLines) === JSON.stringify(expectedLines));
  check("DOCX contains the accepted wording and the untouched original lines", raw.value.includes("delivering it on time") && raw.value.includes("Presented fortnightly progress updates to the steering group") && raw.value.includes("Stakeholder management, agile delivery"));
  check("DOCX has no extra content beyond the CV lines", gotLines.length === expectedLines.length);

  const html = (await mammoth.convertToHtml({ buffer })).value;
  check("DOCX has no tables or images", !/<table|<img/i.test(html));
  check("DOCX uses real headings and list items", /<h1>(<strong>)?PROFILE/.test(html) && /<li>/.test(html));

  // ---------- The export modules never touch the network or the AI ----------
  for (const file of ["lib/export.ts", "lib/export-docx.ts"]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    check(`${file} has no network, AI or storage code`, !/anthropic|fetch\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|writeFile/i.test(src));
  }

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
