// Parses a generated sample PDF and DOCX through the same code the API uses,
// and prints the text. Everything is in memory unless you pass --write <dir>,
// which saves the two (fake) sample files so you can try uploading them.
//
// Run: npx tsx scripts/parse-sample.ts [--write <dir>]

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Packer, Paragraph } from "docx";
import { parseCvFile } from "../lib/cv-text";

const BODY: string[][] = [
  [
    "Jane Sample",
    "Programme Manager",
    "Profile",
    "Programme manager with experience delivering digital change across public sector teams.",
  ],
  [
    "Experience",
    "Programme Manager, Example Council, 2019 to 2024",
    "- Led delivery of a customer portal migration across three teams",
    "- Presented fortnightly progress updates to the steering group",
  ],
  [
    "Education",
    "BA Business Studies, Example University, 2012 to 2015",
    "Skills",
    "Stakeholder management, agile delivery, risk and issue tracking",
  ],
];

function buildPdf(): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const pageStream = (lines: string[], n: number) => {
    const all = ["Jane Sample - Curriculum Vitae", ...lines, `Page ${n} of ${BODY.length}`];
    const ys = [800, ...lines.map((_, i) => 740 - i * 24), 40];
    return all.map((l, i) => `BT /F1 11 Tf 50 ${ys[i]} Td (${esc(l)}) Tj ET`).join("\n");
  };

  // Objects: 1 catalog, 2 pages, 3 font, then (page, content) pairs.
  const objs: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${BODY.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${BODY.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  BODY.forEach((lines, i) => {
    const stream = pageStream(lines, i + 1);
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

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

async function buildDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: BODY.flat().flatMap((l, i) =>
          // add some messy blank lines to prove cleaning works
          i % 4 === 0 ? [new Paragraph(""), new Paragraph(""), new Paragraph(l)] : [new Paragraph(l)],
        ),
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

async function main() {
  const pdf = buildPdf();
  const docx = await buildDocx();

  const dirIdx = process.argv.indexOf("--write");
  if (dirIdx !== -1 && process.argv[dirIdx + 1]) {
    const dir = process.argv[dirIdx + 1];
    writeFileSync(join(dir, "sample-cv.pdf"), pdf);
    writeFileSync(join(dir, "sample-cv.docx"), docx);
    console.log(`Wrote sample files to ${dir}\n`);
  }

  for (const [name, buf] of [
    ["sample-cv.pdf", pdf],
    ["sample-cv.docx", docx],
  ] as const) {
    console.log(`===== ${name} =====`);
    console.log(await parseCvFile(buf, name));
    console.log();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
