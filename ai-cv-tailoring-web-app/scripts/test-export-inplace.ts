// Offline checks that a Word upload is edited IN PLACE: everything except the
// accepted bullets' text stays exactly as the author made it. No API calls.
// Run: npx tsx scripts/test-export-inplace.ts

import JSZip from "jszip";
import { JSDOM } from "jsdom";
import mammoth from "mammoth";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { parseCv } from "../lib/bullets";
import { parseCvFile } from "../lib/cv-text";
import { buildExport } from "../lib/export";
import { editDocxInPlace, type DomApi } from "../lib/export-docx-inplace";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const FONT = "Calibri";
const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color });

/** A CV with a distinctive look: Calibri 10pt, coloured headings, a table, a header and footer, custom margins. */
async function sampleDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1100, right: 900, bottom: 1100, left: 900 } } },
        headers: { default: new Header({ children: [new Paragraph({ children: [run("Jane Sample - Curriculum Vitae", { size: 16 })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ children: [run("Confidential", { size: 16 })] })] }) },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Jane Sample", { bold: true, size: 36, color: "1F3864" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Programme Manager", { size: 24 })] }),
          new Paragraph({ children: [run("EXPERIENCE", { bold: true, size: 26, color: "1F3864" })] }),
          new Paragraph({ children: [run("Programme Manager, Example Council, 2019 to 2024", { bold: true })] }),
          // bold lead-in plus normal text in one bullet
          new Paragraph({ bullet: { level: 0 }, children: [run("Delivery: ", { bold: true }), run("Led delivery of a customer portal migration across three teams")] }),
          // a typed bullet character, not a Word list
          new Paragraph({ children: [run("• Presented fortnightly progress updates to the steering group")] }),
          new Paragraph({ bullet: { level: 0 }, children: [run("Managed budgets")] }),
          new Paragraph({ children: [run("SKILLS", { bold: true, size: 26, color: "1F3864" })] }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ bullet: { level: 0 }, children: [run("Stakeholder management and agile delivery")] })] }),
                  new TableCell({ children: [new Paragraph({ bullet: { level: 0 }, children: [run("Risk and issue tracking in Excel")] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [run("PROJECTS", { bold: true, size: 26, color: "1F3864" })] }),
          new Paragraph({ bullet: { level: 0 }, children: [run("Managed budgets")] }), // duplicate text on purpose
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

const jsdomApi: DomApi = {
  parse: (xml) => new JSDOM(xml, { contentType: "application/xml" }).window.document,
  serialize: (doc) => new (doc.defaultView as unknown as { XMLSerializer: new () => XMLSerializer }).XMLSerializer().serializeToString(doc),
};

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const paraTexts = (xml: string) =>
  Array.from(jsdomApi.parse(xml).getElementsByTagNameNS(W, "p")).map((p) =>
    Array.from(p.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join(""),
  );
const count = (xml: string, re: RegExp) => (xml.match(re) ?? []).length;
const attrs = (xml: string, re: RegExp) => [...xml.matchAll(re)].map((m) => m[1]).sort().join(",");

async function main() {
  const original = await sampleDocx();
  const cv = await parseCvFile(original, "sample.docx").catch(() => "");
  check("sample CV parses through the real upload code", cv.includes("Led delivery of a customer portal migration"));

  const bullets = parseCv(cv).flatMap((l) => (l.kind === "bullet" ? [l] : []));
  const idOf = (start: string, nth = 0) => bullets.filter((b) => b.text.startsWith(start))[nth]?.id ?? "";
  const B_lead = idOf("Delivery: Led delivery");
  const B_typed = idOf("Presented fortnightly");
  const B_table = idOf("Stakeholder management");
  const B_dup2 = idOf("Managed budgets", 1);
  check("bullets located by text", !!B_lead && !!B_typed && !!B_table && !!B_dup2 && B_dup2 !== idOf("Managed budgets", 0));

  const accepted = [
    { id: B_lead, text: "Led the customer portal migration across three teams, delivering it on time." },
    { id: B_typed, text: "Presented fortnightly updates to the steering group." },
    { id: B_table, text: "Stakeholder management and agile delivery across three teams." },
    { id: B_dup2, text: "Managed budgets across the projects portfolio." },
  ];
  const built = buildExport(cv, accepted);
  check("export produced the four changes", built.changes.length === 4);

  const result = await editDocxInPlace(original, built.changes, jsdomApi);
  check("all four bullets applied in the original file", result.applied.length === 4 && result.unmatched.length === 0);

  // ---------- Everything else in the file is untouched ----------
  const zipA = await JSZip.loadAsync(original, { createFolders: false });
  const zipB = await JSZip.loadAsync(result.data, { createFolders: false });
  const namesA = Object.keys(zipA.files).sort();
  const namesB = Object.keys(zipB.files).sort();
  check("same parts in the file", JSON.stringify(namesA) === JSON.stringify(namesB));
  const others = namesA.filter((n) => n !== "word/document.xml" && !zipA.files[n].dir);
  let identical = true;
  for (const n of others) {
    const a = await zipA.file(n)!.async("uint8array");
    const b = await zipB.file(n)!.async("uint8array");
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) identical = false;
  }
  check(`every other part is byte-identical (styles, numbering, header, footer... ${others.length} parts)`, identical);

  const xmlA = await zipA.file("word/document.xml")!.async("string");
  const xmlB = await zipB.file("word/document.xml")!.async("string");
  check("table is intact", count(xmlA, /<w:tbl[ >]/g) === 1 && count(xmlB, /<w:tbl[ >]/g) === 1);
  check("page size and margins are unchanged", attrs(xmlA, /<w:pgMar([^>]*)\/>/g) === attrs(xmlB, /<w:pgMar([^>]*)\/>/g) && /<w:pgMar/.test(xmlB));
  check("header and footer references are unchanged", count(xmlA, /w:headerReference/g) === count(xmlB, /w:headerReference/g) && count(xmlA, /w:footerReference/g) === count(xmlB, /w:footerReference/g));
  check("font and size settings are unchanged (same fonts, sizes, colours, alignment)",
    attrs(xmlA, /<w:rFonts[^>]*w:ascii="([^"]*)"/g).split(",").every((f) => f === FONT) &&
      attrs(xmlB, /<w:rFonts[^>]*w:ascii="([^"]*)"/g).split(",").every((f) => f === FONT) &&
      new Set(attrs(xmlA, /<w:sz w:val="(\d+)"/g).split(",")).size === new Set(attrs(xmlB, /<w:sz w:val="(\d+)"/g).split(",")).size &&
      attrs(xmlB, /<w:color w:val="([^"]*)"/g).includes("1F3864") &&
      count(xmlA, /<w:jc /g) === count(xmlB, /<w:jc /g));
  check("paragraph properties (bullets, spacing) are unchanged", count(xmlA, /<w:pPr>/g) === count(xmlB, /<w:pPr>/g) && count(xmlA, /<w:numPr>/g) === count(xmlB, /<w:numPr>/g));

  // ---------- Only the accepted bullets' text changed ----------
  const before = paraTexts(xmlA);
  const after = paraTexts(xmlB);
  check("same number of paragraphs", before.length === after.length);
  const changedIdx = before.map((t, i) => (t !== after[i] ? i : -1)).filter((i) => i >= 0);
  check("exactly the four accepted bullets changed", changedIdx.length === 4);
  check("accepted wording is in the file", after.some((t) => t.includes("delivering it on time")) && after.some((t) => t.includes("across the projects portfolio")));
  check("the typed bullet character is kept", after.some((t) => t.startsWith("• Presented fortnightly updates to the steering group")));
  check("the duplicate bullet: only the chosen one (the second) changed", before.filter((t) => t === "Managed budgets").length === 2 && after.filter((t) => t === "Managed budgets").length === 1 && after.includes("Managed budgets across the projects portfolio."));
  check("the table cell bullet changed inside the table", after.includes("Stakeholder management and agile delivery across three teams.") && after.includes("Risk and issue tracking in Excel"));

  // The bold lead-in bullet: new text keeps the formatting of the longest (normal-weight) run.
  const docB = jsdomApi.parse(xmlB);
  const leadPara = Array.from(docB.getElementsByTagNameNS(W, "p")).find((p) => p.textContent?.includes("delivering it on time"))!;
  const leadRuns = Array.from(leadPara.getElementsByTagNameNS(W, "r"));
  const withText = leadRuns.filter((r) => r.textContent);
  check("new text sits in a single run that keeps the original (not bold) run formatting", withText.length === 1 && withText[0].getElementsByTagNameNS(W, "b").length === 0 && withText[0].getElementsByTagNameNS(W, "rFonts")[0]?.getAttribute("w:ascii") === FONT);

  // ---------- Round trip through a Word reader ----------
  const raw = await mammoth.extractRawText({ buffer: Buffer.from(result.data) });
  check("file reads back cleanly with the new text", raw.value.includes("delivering it on time") && raw.value.includes("Jane Sample") && raw.value.includes("EXPERIENCE"));

  // ---------- Unmatched bullets are reported and left alone ----------
  const edited = buildExport(cv.replace("Risk and issue tracking in Excel", "Risk tracking (text edited by the user)"), [
    { id: idOf("Risk and issue") || "B99", text: "Risk and issue tracking in Excel and Jira." },
    { id: B_typed, text: "Presented fortnightly updates." },
  ]);
  const partial = await editDocxInPlace(original, edited.changes, jsdomApi);
  const xmlC = await (await JSZip.loadAsync(partial.data)).file("word/document.xml")!.async("string");
  check("a bullet whose text no longer matches the file is reported, not guessed", partial.unmatched.length >= 1 || edited.changes.length === 1);
  check("unmatched bullets are left exactly as in the original", paraTexts(xmlC).includes("Risk and issue tracking in Excel"));
  check("matched bullets in the same run are still applied", partial.applied.length >= 1 && paraTexts(xmlC).some((t) => t.includes("Presented fortnightly updates.")));

  const none = await editDocxInPlace(original, [], jsdomApi);
  const xmlN = await (await JSZip.loadAsync(none.data)).file("word/document.xml")!.async("string");
  check("with nothing to change the document text is untouched", JSON.stringify(paraTexts(xmlN)) === JSON.stringify(before) && none.applied.length === 0);

  // ---------- Not a Word file ----------
  let threw = false;
  try {
    await editDocxInPlace(new TextEncoder().encode("not a zip"), [], jsdomApi);
  } catch {
    threw = true;
  }
  check("a non-Word file is rejected with an error", threw);

  // ---------- A plain summary paragraph (no bullet marker) ----------
  {
    const summaryDoc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [run("Casey Sample", { bold: true, size: 36 })] }),
            new Paragraph({ children: [run("PERSONAL SUMMARY", { bold: true, size: 26 })] }),
            new Paragraph({ children: [run("Performance marketer with "), run("8 years", { bold: true }), run(" of experience managing paid social campaigns.")] }),
            new Paragraph({ children: [run("EXPERIENCE", { bold: true, size: 26 })] }),
            new Paragraph({ bullet: { level: 0 }, children: [run("Managed £5M annual media spend across paid social")] }),
          ],
        },
      ],
    });
    const buf = Buffer.from(await Packer.toBuffer(summaryDoc));
    const cvS = await parseCvFile(buf, "summary.docx").catch(() => "");
    const summaryLine = parseCv(cvS).flatMap((l) => (l.kind === "bullet" ? [l] : [])).find((b) => b.section === "PERSONAL SUMMARY");
    check("the summary paragraph is found as a bullet under its heading", !!summaryLine);
    const builtS = buildExport(cvS, [{ id: summaryLine?.id ?? "", text: "Performance marketer with 8 years of experience running paid social campaigns." }]);
    const resS = await editDocxInPlace(buf, builtS.changes, jsdomApi);
    const xmlS = await (await JSZip.loadAsync(resS.data)).file("word/document.xml")!.async("string");
    const textsS = paraTexts(xmlS);
    check("the summary is replaced in place", resS.applied.length === 1 && textsS.includes("Performance marketer with 8 years of experience running paid social campaigns."));
    check("the rest of the CV is untouched", textsS.includes("PERSONAL SUMMARY") && textsS.includes("Managed £5M annual media spend across paid social") && textsS.includes("Casey Sample"));
  }

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
