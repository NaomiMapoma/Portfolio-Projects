import { Document, Packer, Paragraph, TextRun } from "docx";
import { DEFAULT_STYLE, type DocStyle } from "./export-style";

// A plain, single-column Word file of the cover letter text. Built in the
// browser from the text on the page: no API call, nothing stored.

const twips = (pt: number) => Math.round(pt * 20);

export function buildLetterDocument(text: string, style: DocStyle = DEFAULT_STYLE): Document {
  const font = style.fontFamily;
  const size = Math.round(style.bodySize * 2);
  const m = style.margins;

  // Paragraphs are separated by blank lines; single line breaks stay as line breaks.
  const children = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 200 },
          children: block
            .split("\n")
            .map((line, i) => new TextRun({ text: line.trim(), font, size, break: i > 0 ? 1 : undefined })),
        }),
    );

  return new Document({
    creator: "FastTrack",
    title: "Cover letter",
    styles: { default: { document: { run: { font, size } } } },
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

export async function buildLetterBlob(text: string, style?: DocStyle): Promise<Blob> {
  return Packer.toBlob(buildLetterDocument(text, style));
}

export async function buildLetterBuffer(text: string, style?: DocStyle): Promise<Buffer> {
  return Packer.toBuffer(buildLetterDocument(text, style));
}
