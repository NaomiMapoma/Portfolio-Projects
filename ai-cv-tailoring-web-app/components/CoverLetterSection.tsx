import { useState } from "react";
import type { DocStyle } from "@/lib/export-style";
import { countWords, MAX_WORDS, MIN_WORDS } from "@/lib/letter-checks";
import { MAX_SAMPLE_CHARS } from "@/lib/limits";

export type LetterState = {
  /** The text in the box (the user may have edited it). */
  text: string;
  /** The text as generated, so we can tell when it has been edited since the check. */
  generated: string;
  verification: "supported" | "check";
  issues: string[];
  styleNotes: string[];
  acceptedUsed: number;
  usage: { input: number; output: number };
};

type Props = {
  letter: LetterState | null;
  busy: boolean;
  error: string;
  acceptedCount: number;
  style?: DocStyle;
  onGenerate: (writingSample: string) => void;
  onChange: (text: string) => void;
};

export default function CoverLetterSection({ letter, busy, error, acceptedCount, style, onGenerate, onChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [fileError, setFileError] = useState("");
  // Optional writing sample. Lives only in this component, so Start over clears it. Never stored.
  const [sample, setSample] = useState("");

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFileError("Couldn't copy. Your browser may have blocked clipboard access.");
    }
  }

  async function download() {
    if (!letter) return;
    setFileError("");
    try {
      const { buildLetterBlob } = await import("@/lib/letter-docx");
      const url = URL.createObjectURL(await buildLetterBlob(letter.text, style));
      const a = document.createElement("a");
      a.href = url;
      a.download = "cover-letter.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFileError("Couldn't create the file. Try Copy instead.");
    }
  }

  const words = letter ? countWords(letter.text) : 0;
  const edited = !!letter && letter.text !== letter.generated;
  const supported = letter?.verification === "supported";

  return (
    <section aria-labelledby="cl-heading" className="rounded-xl border border-gray-500 p-4 sm:p-6">
      <h3 id="cl-heading" className="text-lg font-semibold">
        Cover letter
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        A short letter in your own voice, using only facts from your CV, your answers and your notes
        {acceptedCount > 0 ? `, and the ${acceptedCount} ${acceptedCount === 1 ? "line" : "lines"} you kept in your tailored CV` : ""}.
        It is only written when you click the button. Clicking sends your CV and job description to the Claude API
        (and your answers, notes and writing sample, if you add them, and nowhere else), and it costs tokens each time.
        This app does not store them.
      </p>

      <div className="mt-4">
        <label htmlFor="writing-sample" className="text-base font-medium">
          Optional: something you have written, so the letter sounds more like you
        </label>
        <p className="text-sm text-gray-600">
          For example a short email or an old cover letter. It is used only for tone and rhythm, never for facts.
        </p>
        <textarea
          id="writing-sample"
          value={sample}
          onChange={(e) => setSample(e.target.value.slice(0, MAX_SAMPLE_CHARS))}
          rows={4}
          className="mt-2 w-full rounded-lg border border-gray-500 p-3 text-base"
          placeholder="Paste a paragraph or two of your own writing (optional)"
        />
        <p className="text-sm text-gray-600">
          {sample.length.toLocaleString("en-GB")} of {MAX_SAMPLE_CHARS.toLocaleString("en-GB")} characters
        </p>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onGenerate(sample)}
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {busy ? "Writing…" : letter ? "Generate again (uses more tokens)" : "Generate cover letter"}
        </button>
        {busy && (
          <p role="status" className="mt-3 text-sm text-gray-600">
            Writing your letter and checking it against your CV. This usually takes under a minute.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {error}
          </p>
        )}
      </div>

      {letter && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="cover-letter" className="text-base font-medium">
              Your letter (editable)
            </label>
            <span
              className={
                supported
                  ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-900"
                  : "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900"
              }
            >
              {supported ? "Supported by your CV" : "Check this claim"}
            </span>
          </div>

          {!supported && letter.issues.length > 0 && (
            <ul className="list-disc rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900">
              {letter.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
          {edited && (
            <p className="text-sm text-gray-600">
              You&apos;ve edited this letter, so the tag above only covers the version that was checked. Read your
              changes against your CV yourself.
            </p>
          )}

          <textarea
            id="cover-letter"
            value={letter.text}
            onChange={(e) => onChange(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-500 p-3 text-base leading-relaxed"
          />

          <p className="text-sm text-gray-600">
            {words} words{words >= MIN_WORDS && words <= MAX_WORDS ? "" : ` (the aim is ${MIN_WORDS} to ${MAX_WORDS})`}
          </p>
          {letter.styleNotes.filter((n) => !/^\d+ words/.test(n)).length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-600">
              {letter.styleNotes.filter((n) => !/^\d+ words/.test(n)).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void copy()} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2">
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={() => void download()} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2">
              Download DOCX
            </button>
          </div>
          {fileError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
              {fileError}
            </p>
          )}
          <p className="text-sm text-gray-600">
            Tokens used for the letter and its check: {letter.usage.input.toLocaleString("en-GB")} in,{" "}
            {letter.usage.output.toLocaleString("en-GB")} out. The Word file is created in your browser and nothing is
            stored.
          </p>
        </div>
      )}
    </section>
  );
}
