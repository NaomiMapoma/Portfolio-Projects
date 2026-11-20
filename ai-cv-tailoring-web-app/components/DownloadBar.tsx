import { useEffect, useMemo, useState } from "react";
import { buildExport, type AcceptedRewrite } from "@/lib/export";
import type { CvSource } from "@/lib/export-style";

type Props = {
  cv: string;
  cvSource: CvSource;
  /** The lines to apply: rewrites, shortenings and cuts the user is keeping. */
  accepted: AcceptedRewrite[];
};

type InPlace =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error" }
  | { status: "ready"; data: Uint8Array; applied: string[]; unmatched: { id: string; reason: string }[] };

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Builds the file in the browser from data already on the page. No API call, nothing stored or sent.
export default function DownloadBar({ cv, cvSource, accepted }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Result of editing the original Word file, tagged with the changes it was made for.
  const [edited, setEdited] = useState<{ forChanges: unknown; result: InPlace } | null>(null);

  const built = useMemo(() => buildExport(cv, accepted), [cv, accepted]);
  const noChanges = built.changes.length === 0;
  const isDocx = cvSource?.kind === "docx";
  const isPdf = cvSource?.kind === "pdf";

  // Word uploads: edit the original file in place (kept in this tab's memory) so the look is exactly as uploaded.
  const needsInPlace = cvSource?.kind === "docx" && built.changes.length > 0;
  useEffect(() => {
    if (cvSource?.kind !== "docx" || built.changes.length === 0) return;
    let cancelled = false;
    (async () => {
      let result: InPlace;
      try {
        const { editDocxInPlace } = await import("@/lib/export-docx-inplace");
        result = { status: "ready", ...(await editDocxInPlace(cvSource.bytes, built.changes)) };
      } catch {
        result = { status: "error" };
      }
      if (!cancelled) setEdited({ forChanges: built.changes, result });
    })();
    return () => {
      cancelled = true;
    };
  }, [cvSource, built.changes]);
  const inPlace: InPlace = !needsInPlace
    ? { status: "idle" }
    : edited && edited.forChanges === built.changes
      ? edited.result
      : { status: "working" };

  async function downloadPrimary() {
    setBusy(true);
    setError("");
    try {
      if (isDocx) {
        if (inPlace.status !== "ready") return;
        saveBlob(new Blob([inPlace.data as BlobPart], { type: DOCX_MIME }), "tailored-cv.docx");
      } else {
        const { buildDocxBlob } = await import("@/lib/export-docx");
        const style = cvSource?.kind === "pdf" ? (cvSource.style ?? undefined) : undefined;
        saveBlob(await buildDocxBlob(built.lines, style), "tailored-cv.docx");
      }
    } catch {
      setError("Couldn't create the file. Try “Copy as text” instead.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPlain() {
    setBusy(true);
    setError("");
    try {
      const { buildDocxBlob } = await import("@/lib/export-docx");
      saveBlob(await buildDocxBlob(built.lines), "tailored-cv-plain.docx");
    } catch {
      setError("Couldn't create the file. Try “Copy as text” instead.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(built.plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Your browser may have blocked clipboard access.");
    }
  }

  const primaryLabel = isDocx ? "Download in my original format" : isPdf ? "Download Word file (matched to my PDF)" : "Download Word file";
  const primaryDisabled = noChanges || busy || (isDocx && (inPlace.status !== "ready" || inPlace.applied.length === 0));
  const unmatched = inPlace.status === "ready" ? inPlace.unmatched : [];
  const fileNote = isDocx
    ? `Made from your uploaded Word file (${cvSource.name}), edited in place. Fonts, sizes, layout, tables and margins stay exactly as you made them. Only the lines above change.`
    : isPdf
      ? cvSource?.kind === "pdf" && cvSource.style
        ? `Rebuilt as a Word file using the font (${cvSource.style.fontFamily}), sizes, bold headings and margins read from your PDF. This is a close match, not an identical copy: columns, colours, graphics and exact spacing aren't reproduced. For an exact match, upload the Word version of your CV.`
        : "I couldn't read the look of your PDF, so the file uses a plain layout. For an exact match, upload the Word version of your CV."
      : "You pasted your CV as text, so there is no original look to match. The file uses a plain, ATS-friendly layout. For an exact match, upload your Word file instead.";

  return (
    <section aria-labelledby="dl-heading" className="rounded-xl border border-gray-500 p-4 sm:p-6">
      <h3 id="dl-heading" className="text-lg font-semibold">
        Download
      </h3>
      <p className="mt-2 text-sm text-gray-700">{fileNote}</p>

      {isDocx && inPlace.status === "working" && <p className="mt-2 text-sm text-gray-600">Preparing your file…</p>}
      {isDocx && inPlace.status === "error" && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
          I couldn&apos;t edit your original Word file. You can still download the plain version or copy the text.
        </p>
      )}
      {unmatched.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">
            {unmatched.length === 1 ? "One line" : `${unmatched.length} lines`} left as in your original file, because I couldn&apos;t find{" "}
            {unmatched.length === 1 ? "it" : "them"} safely:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {unmatched.map((u) => (
              <li key={u.id}>{u.reason}</li>
            ))}
          </ul>
          <p className="mt-1">Copy the new wording into your file by hand, or use the plain version.</p>
        </div>
      )}
      {isDocx && inPlace.status === "ready" && inPlace.applied.length > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          Longer or shorter lines can change where text wraps and where pages break, so check the page count.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void downloadPrimary()}
          disabled={primaryDisabled}
          className="min-h-11 rounded-lg bg-accent px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {busy ? "Preparing…" : primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => void downloadPlain()}
          disabled={noChanges || busy}
          className="min-h-11 rounded-lg border border-gray-500 px-5 py-2 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          Plain ATS-friendly version
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={noChanges}
          className="min-h-11 rounded-lg border border-gray-500 px-5 py-2 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {copied ? "Copied" : "Copy as text"}
        </button>
      </div>
      {noChanges && <p className="mt-2 text-sm text-gray-600">There are no changes to apply, so the file would match your original.</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-gray-600">Your file is created in your browser. Nothing is sent anywhere or stored.</p>
    </section>
  );
}
