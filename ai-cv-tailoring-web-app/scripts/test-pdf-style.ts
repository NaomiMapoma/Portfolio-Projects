// Checks that the look of a PDF (font, sizes, bold headings, page size, margins)
// is detected, and that the Word builder applies it. Offline, in memory.
// Run: npx tsx scripts/test-pdf-style.ts

import JSZip from "jszip";
import { parseCvFileWithStyle } from "../lib/cv-text";
import { buildExport } from "../lib/export";
import { buildDocxBuffer } from "../lib/export-docx";
import { DEFAULT_STYLE, parseFontName } from "../lib/export-style";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// A one-page PDF with known styling: body Helvetica 10pt, headings Helvetica-Bold 14pt,
// name Helvetica-Bold 18pt, left edge at x=60.
function buildPdf(): Buffer {
  const rows: { text: string; font: "F1" | "F2"; size: number }[] = [
    { text: "Jane Sample", font: "F2", size: 18 },
    { text: "Programme Manager", font: "F1", size: 10 },
    { text: "EXPERIENCE", font: "F2", size: 14 },
    { text: "Programme Manager, Example Council, 2019 to 2024", font: "F1", size: 10 },
    { text: "- Led delivery of a customer portal migration across three teams", font: "F1", size: 10 },
    { text: "- Presented fortnightly progress updates to the steering group", font: "F1", size: 10 },
    { text: "SKILLS", font: "F2", size: 14 },
    { text: "Stakeholder management, agile delivery, risk and issue tracking", font: "F1", size: 10 },
  ];
  let y = 770;
  const stream = rows
    .map((r) => {
      y -= r.size + 12;
      return `BT /${r.font} ${r.size} Tf 60 ${y} Td (${r.text.replace(/[\\()]/g, "\\$&")}) Tj ET`;
    })
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

async function main() {
  // ---------- Font name clean-up ----------
  check("subset prefix and bold suffix are removed", JSON.stringify(parseFontName("ABCDEF+Calibri-Bold")) === JSON.stringify({ family: "Calibri", bold: true }));
  check("ArialMT maps to Arial", parseFontName("ArialMT").family === "Arial");
  check("Arial-BoldMT is bold Arial", JSON.stringify(parseFontName("Arial-BoldMT")) === JSON.stringify({ family: "Arial", bold: true }));
  check("TimesNewRomanPS-BoldMT maps to Times New Roman", parseFontName("TimesNewRomanPS-BoldMT").family === "Times New Roman" && parseFontName("TimesNewRomanPS-BoldMT").bold);
  check("Helvetica maps to Arial", parseFontName("Helvetica").family === "Arial");
  check("CamelCase names get spaces", parseFontName("OpenSans-Regular").family === "Open Sans");

  // ---------- Detection from a real PDF ----------
  const parsed = await parseCvFileWithStyle(buildPdf(), "cv.pdf");
  const s = parsed.style;
  check("a style is detected", !!s);
  if (s) {
    console.log("      detected:", JSON.stringify(s));
    check("body font family detected (Helvetica -> Arial)", s.fontFamily === "Arial");
    check("body size detected (10pt)", s.bodySize === 10);
    check("heading size and bold detected (14pt bold)", s.headingSize === 14 && s.headingBold);
    check("name size and bold detected (18pt bold)", s.nameSize === 18 && s.nameBold);
    check("page size detected (A4)", s.page?.width === 595 && s.page?.height === 842);
    check("left margin detected (about 60pt)", !!s.margins && Math.abs(s.margins.left - 60) < 2);
  }

  // ---------- The Word builder applies the style ----------
  const cv = parsed.text;
  const built = buildExport(cv, []);
  const style = { fontFamily: "Garamond", bodySize: 10, headingSize: 14, headingBold: true, nameSize: 18, nameBold: true, page: { width: 595, height: 842 }, margins: { top: 50, right: 60, bottom: 50, left: 60 } };
  const buf = await buildDocxBuffer(built.lines, style);
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml")!.async("string");
  const styles = await zip.file("word/styles.xml")!.async("string");
  check("matched file uses the detected font", /w:ascii="Garamond"/.test(doc) && /w:ascii="Garamond"/.test(styles));
  check("matched file uses the detected body, heading and name sizes (half-points)", /w:sz w:val="20"/.test(doc) && /w:sz w:val="28"/.test(doc) && /w:sz w:val="36"/.test(doc));
  check("matched file uses the detected page size and margins (twips)", /w:w="11900"/.test(doc) && /w:h="16840"/.test(doc) && /w:left="1200"/.test(doc) && /w:top="1000"/.test(doc));
  const plain = await JSZip.loadAsync(await buildDocxBuffer(built.lines));
  const plainDoc = await plain.file("word/document.xml")!.async("string");
  check("with no style the plain Arial 11pt version is unchanged", /w:ascii="Arial"/.test(plainDoc) && /w:sz w:val="22"/.test(plainDoc) && DEFAULT_STYLE.fontFamily === "Arial");
  check("no tables or images in the matched file", !/<w:tbl|<w:drawing|<w:pict/.test(doc));

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
