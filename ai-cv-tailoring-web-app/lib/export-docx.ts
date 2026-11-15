import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { ExportLine } from "./export";
import { DEFAULT_STYLE, type DocStyle } from "./export-style";

// Word file rebuilt from the export lines. With no style it is the plain,
// ATS-friendly version (single column, Arial 11pt). With a detected style (PDF
// uploads) it uses that font, sizes, heading weight, page size and margins.
// Only paragraphs and text runs: no tables, images, text boxes, headers or
// footers. Built entirely in memory.

const twips = (pt: number) => Math.round(pt * 20);

export function buildDocument(lines: ExportLine[], style: DocStyle = DEFAULT_STYLE): Document {
  const font = style.fontFamily;
  const body = Math.round(style.bodySize * 2); // half-points
  const run = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text, font, size: opts.size ?? body, bold: opts.bold });

  const children: Paragraph[] = [];
  let sawContent = false;

  for (const line of lines) {
    if (line.kind === "blank") continue; // spacing comes from paragraph spacing

    if (line.kind === "heading") {
      sawContent = true;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 80 },
          children: [run(line.text, { bold: style.headingBold, size: Math.round(style.headingSize * 2) })],
        }),
      );
    } else if (line.kind === "bullet") {
      sawContent = true;
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(line.text)] }));
    } else {
      // The first line is usually the candidate's name.
      const isName = !sawContent;
      sawContent = true;
      children.push(
        new Paragraph({
          spacing: { after: isName ? 80 : 40 },
          children: [run(line.text, isName ? { bold: style.nameBold, size: Math.round(style.nameSize * 2) } : {})],
        }),
      );
    }
  }

  const m = style.margins;
  return new Document({
    creator: "FastTrack",
    title: "CV",
    styles: {
      default: { document: { run: { font, size: body } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, size: Math.round(style.headingSize * 2), bold: style.headingBold, color: "000000" },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            ...(style.page ? { size: { width: twips(style.page.width), height: twips(style.page.height) } } : {}),
            ...(m ? { margin: { top: twips(m.top), right: twips(m.right), bottom: twips(m.bottom), left: twips(m.left) } } : {}),
          },
        },
        children,
      },
    ],
  });
}

/** For the browser download. */
export async function buildDocxBlob(lines: ExportLine[], style?: DocStyle): Promise<Blob> {
  return Packer.toBlob(buildDocument(lines, style));
}

/** For tests in Node. */
export async function buildDocxBuffer(lines: ExportLine[], style?: DocStyle): Promise<Buffer> {
  return Packer.toBuffer(buildDocument(lines, style));
}
