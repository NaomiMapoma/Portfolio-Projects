import { useState } from "react";
import type { CvSource, DocStyle } from "@/lib/export-style";
import { MAX_CV_CHARS, MAX_JD_CHARS, MAX_NOTES_CHARS } from "@/lib/limits";

type Props = {
  cv: string;
  jd: string;
  /** Optional extra background that is not on the CV. Counts as evidence, like the user's answers. */
  notes: string;
  onNotesChange: (value: string) => void;
  onCvChange: (value: string) => void;
  /** Called with where the CV came from, so the export can keep the original look. */
  onCvSource: (source: CvSource) => void;
  onJdChange: (value: string) => void;
  onAnalyse: () => void;
  analysing?: boolean;
};

/** Live length check, so a too-long input is spotted before anything is sent. */
function CharCount({ n, max, what }: { n: number; max: number; what: string }) {
  const over = n > max;
  const near = n > max * 0.9;
  return (
    <p
      role={over ? "alert" : undefined}
      className={over ? "mt-1 text-sm font-medium text-red-700" : near ? "mt-1 text-sm text-amber-800" : "mt-1 text-sm text-gray-600"}
    >
      {n.toLocaleString("en-GB")} of {max.toLocaleString("en-GB")} characters
      {over
        ? `. Your ${what} is too long. Please shorten it (remove older roles or boilerplate) before assessing.`
        : near
          ? `. Your ${what} is close to the limit.`
          : ""}
    </p>
  );
}

export default function InputsStep({
  cv,
  jd,
  notes,
  onNotesChange,
  onCvChange,
  onCvSource,
  onJdChange,
  onAnalyse,
  analysing = false,
}: Props) {
  const cvOver = cv.length > MAX_CV_CHARS;
  const jdOver = jd.length > MAX_JD_CHARS;
  const notesOver = notes.length > MAX_NOTES_CHARS;
  const ready = cv.trim().length > 0 && jd.trim().length > 0 && !cvOver && !jdOver && !notesOver && !analysing;
  const [busy, setBusy] = useState(false);
  const [cvError, setCvError] = useState("");
  const [cvNote, setCvNote] = useState("");
  const [jdMode, setJdMode] = useState<"paste" | "url">("paste");
  const [jdUrl, setJdUrl] = useState("");
  const [jdBusy, setJdBusy] = useState(false);
  const [jdError, setJdError] = useState("");
  const [jdNote, setJdNote] = useState("");

  // Sends the file (or pasted text) to our own server route, in memory only.
  async function send(init: RequestInit, successNote: string, source?: (style: DocStyle | null) => CvSource) {
    setBusy(true);
    setCvError("");
    setCvNote("");
    try {
      const res = await fetch("/api/parse-cv", init);
      const data = (await res.json()) as { text?: string; style?: DocStyle | null; error?: string };
      if (!res.ok || typeof data.text !== "string") {
        setCvError(data.error ?? "Something went wrong. Please paste the text instead.");
      } else {
        onCvChange(data.text);
        if (source) onCvSource(source(data.style ?? null));
        setCvNote(successNote);
      }
    } catch {
      setCvError("Couldn't reach the app. Please try again or paste the text.");
    } finally {
      setBusy(false);
    }
  }

  async function fetchJd() {
    setJdBusy(true);
    setJdError("");
    setJdNote("");
    try {
      const res = await fetch("/api/fetch-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || typeof data.text !== "string") {
        setJdError(data.error ?? "I couldn't read that page. Please paste the job description instead.");
      } else {
        onJdChange(data.text);
        setJdNote("Text fetched. Check it below and remove anything you don't need.");
      }
    } catch {
      setJdError("Couldn't reach the app. Please try again or paste the job description.");
    } finally {
      setJdBusy(false);
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    // Keep the original file in this tab's memory (never stored or re-sent) so the
    // export can be made in the same format.
    const bytes = isDocx ? await file.arrayBuffer() : null;
    await send(
      { method: "POST", body },
      "Text extracted. Check it below and fix anything that looks wrong.",
      (style) => (bytes ? { kind: "docx", bytes, name: file.name } : { kind: "pdf", style, name: file.name }),
    );
  }

  function tidyPasted() {
    void send(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cv }),
      },
      "Extra spaces and page numbers removed.",
    );
  }

  return (
    <section aria-labelledby="inputs-heading">
      <h2 id="inputs-heading" className="mb-4 text-2xl font-semibold">
        Step 1: Inputs
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4 sm:p-6">
          <label htmlFor="cv" className="mb-3 block text-lg font-semibold">
            Your CV
          </label>

          <label
            htmlFor="cv-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void uploadFile(e.dataTransfer.files[0]);
            }}
            className="mb-3 flex h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-500 px-4 py-2 text-center text-sm text-gray-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
          >
            {busy ? "Reading file…" : "Upload a PDF or Word (.docx) file, or drop it here (max 5MB)"}
            <input
              id="cv-file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                void uploadFile(e.target.files?.[0]);
                e.target.value = ""; // allow re-selecting the same file
              }}
            />
          </label>

          <textarea
            id="cv"
            value={cv}
            onChange={(e) => onCvChange(e.target.value)}
            placeholder="Or paste your CV text here. Uploaded text appears here so you can edit it."
            className="h-80 w-full resize-none rounded-lg border border-gray-500 p-3 text-base"
          />
          <CharCount n={cv.length} max={MAX_CV_CHARS} what="CV" />

          {cvError && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {cvError}
            </p>
          )}
          {cvNote && !cvError && <p className="mt-2 text-sm text-gray-600">{cvNote}</p>}

          <button
            type="button"
            onClick={tidyPasted}
            disabled={busy || cv.trim().length === 0}
            className="mt-1 min-h-10 rounded px-1 text-sm text-accent underline disabled:cursor-not-allowed disabled:text-gray-600 disabled:no-underline"
          >
            Tidy pasted text
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 sm:p-6">
          <label htmlFor="jd" className="mb-3 block text-lg font-semibold">
            Job description
          </label>

          <div className="mb-3 h-28">
            <div role="group" aria-label="Job description source" className="flex gap-2">
              {(["paste", "url"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={jdMode === m}
                  onClick={() => setJdMode(m)}
                  className={
                    jdMode === m
                      ? "rounded-lg border border-accent bg-accent min-h-10 px-3 py-2 text-sm text-white"
                      : "rounded-lg border border-gray-500 min-h-10 px-3 py-2 text-sm text-gray-700"
                  }
                >
                  {m === "paste" ? "Paste text" : "From URL"}
                </button>
              ))}
            </div>
            {jdMode === "url" ? (
              <div className="mt-3 flex gap-2">
                <input
                  type="url"
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchJd();
                  }}
                  placeholder="https://example.com/jobs/programme-manager"
                  aria-label="Job page address"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-500 px-3 py-2 text-base"
                />
                <button
                  type="button"
                  onClick={() => void fetchJd()}
                  disabled={jdBusy || jdUrl.trim().length === 0}
                  className="min-h-10 rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {jdBusy ? "Fetching…" : "Fetch"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-700">Paste the job description into the box below, or switch to From URL to fetch it from a job page.</p>
            )}
          </div>

          <textarea
            id="jd"
            value={jd}
            onChange={(e) => onJdChange(e.target.value)}
            placeholder={
              jdMode === "url"
                ? "The fetched text will appear here so you can edit it."
                : "Paste the job description here"
            }
            className="h-80 w-full resize-none rounded-lg border border-gray-500 p-3 text-base"
          />
          <CharCount n={jd.length} max={MAX_JD_CHARS} what="job description" />
          {jdError && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {jdError}
            </p>
          )}
          {jdNote && !jdError && <p className="mt-2 text-sm text-gray-600">{jdNote}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4 sm:p-6">
        <label htmlFor="notes" className="mb-1 block text-lg font-semibold">
          Notes <span className="font-normal text-gray-600">(optional)</span>
        </label>
        <p className="mb-2 text-sm text-gray-600">
          Anything relevant that is not on your CV, such as side projects, other roles or tools you have used. It counts
          as evidence, like your answers, so only write what is true.
        </p>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="h-28 w-full rounded-lg border border-gray-500 p-3 text-base"
        />
        <CharCount n={notes.length} max={MAX_NOTES_CHARS} what="notes" />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onAnalyse}
          disabled={!ready}
          className="min-h-11 shrink-0 self-start whitespace-nowrap rounded-lg bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300 sm:self-center"
        >
          {analysing ? "Assessing…" : "Assess my CV"}
        </button>
        <p className="text-sm text-gray-600">
          Your CV, job description and notes are sent securely to the Claude API only to produce your
          assessment, draft and cover letter. This app does not store them. Anthropic&apos;s own retention
          policy applies on its side.
        </p>
      </div>
    </section>
  );
}
