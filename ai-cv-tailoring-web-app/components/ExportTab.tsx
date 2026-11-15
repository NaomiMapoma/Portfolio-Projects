import { useEffect, useMemo, useState } from "react";
import { buildExport } from "@/lib/export";
import type { CvSource } from "@/lib/export-style";
import type { AnalysisCore, RewriteEdit } from "@/lib/types";
import CoverLetterSection, { type LetterState } from "./CoverLetterSection";

type Props = {
  cv: string;
  cvSource: CvSource;
  result: AnalysisCore;
  edits: Record<string, RewriteEdit>;
  keywordChoices: Record<string, boolean>;
  letter: LetterState | null;
  letterBusy: boolean;
  letterError: string;
  onGenerateLetter: (writingSample: string) => void;
  onLetterChange: (text: string) => void;
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

export default function ExportTab({
  cv,
  cvSource,
  result,
  edits,
  keywordChoices,
  letter,
  letterBusy,
  letterError,
  onGenerateLetter,
  onLetterChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Result of editing the original Word file, tagged with the changes it was made for.
  const [edited, setEdited] = useState<{ forChanges: unknown; result: InPlace } | null>(null);

  // Built from data already on the page. No API call, nothing stored.
  const accepted = useMemo(
    () =>
      result.rewrites
        .filter((r) => edits[r.sourceBulletId]?.accepted)
        .map((r) => {
          const e = edits[r.sourceBulletId];
          return { id: r.sourceBulletId, text: e[e.mode] };
        }),
    [result.rewrites, edits],
  );
  const built = useMemo(() => buildExport(cv, accepted), [cv, accepted]);
  const chosenKeywords = result.keywords.addTruthfully.filter((k) => keywordChoices[k.keyword]);
  const noChanges = built.changes.length === 0;
  const isDocx = cvSource?.kind === "docx";
  const isPdf = cvSource?.kind === "pdf";

  // Word uploads: edit the original file in place (kept in this tab's memory) so the
  // look is exactly as uploaded. Done here so any bullet that can't be matched is
  // shown before the user downloads.
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
      setError("Couldn't create the file. Try 'Copy as plain text' instead.");
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
      setError("Couldn't create the file. Try 'Copy as plain text' instead.");
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

  const primaryLabel = isDocx
    ? "Download DOCX (your original format)"
    : isPdf
      ? "Download DOCX (matched to your PDF)"
      : "Download DOCX";
  const primaryDisabled =
    noChanges || busy || (isDocx && (inPlace.status !== "ready" || inPlace.applied.length === 0));
  const unmatched = inPlace.status === "ready" ? inPlace.unmatched : [];

  return (
    <div className="space-y-8">
      <p className="text-gray-700">
        Your tailored CV is your original CV with only the rewrites you accepted applied, using your edits. Everything
        else stays exactly as you wrote it.
      </p>

      <section aria-labelledby="ex-accepted">
        <h3 id="ex-accepted" className="text-lg font-semibold">
          Accepted rewrites
        </h3>
        {accepted.length === 0 ? (
          <p className="mt-2 text-gray-600">
            You haven&apos;t accepted any rewrites yet. Tick &ldquo;Accept this rewrite&rdquo; in the Rewrites tab to
            include one.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {accepted.map((a) => {
              const change = built.changes.find((c) => c.id === a.id);
              const skip = built.skipped.find((s) => s.id === a.id);
              return (
                <li key={a.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                  <p className="text-xs text-gray-500">Bullet {a.id}</p>
                  {change ? (
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="font-medium">Original</p>
                        <p className="mt-1 text-gray-700">{change.before}</p>
                      </div>
                      <div>
                        <p className="font-medium">Your tailored version</p>
                        <p className="mt-1 text-gray-900">{change.after}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-gray-600">{skip?.reason ?? "Not applied."}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {built.withPlaceholders.length > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {built.withPlaceholders.length === 1 ? "One accepted rewrite still contains" : "Some accepted rewrites still contain"}{" "}
          a [placeholder] ({built.withPlaceholders.join(", ")}). It will appear in your file as written. Go back to the
          Rewrites tab and type your real figure, or remove it.
        </p>
      )}

      <section aria-labelledby="ex-keywords">
        <h3 id="ex-keywords" className="text-lg font-semibold">
          Keywords you chose to add
        </h3>
        {chosenKeywords.length === 0 ? (
          <p className="mt-2 text-gray-600">
            None chosen. You can tick keywords in the Keywords tab as a reminder of what to work into your wording.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">
              These are reminders only. They are not added to the file automatically. Use them in your own wording
              where they are true.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {chosenKeywords.map((k) => (
                <li key={k.keyword}>
                  <span className="font-medium">{k.keyword}</span>
                  <span className="text-gray-600">
                    {" "}
                    (evidence in {k.sourceBulletId}: &ldquo;{k.evidenceQuote}&rdquo;; suggested place: {k.suggestedSection})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="ex-changes">
        <h3 id="ex-changes" className="text-lg font-semibold">
          Changes made
        </h3>
        {noChanges ? (
          <p className="mt-2 text-gray-600">No changes. The file would be identical to your original CV.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
            {built.changes.map((c) => (
              <li key={c.id}>Bullet {c.id} replaced with your accepted rewrite.</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ex-file">
        <h3 id="ex-file" className="text-lg font-semibold">
          Your file
        </h3>

        <p className="mt-2 text-sm text-gray-700">
          {isDocx &&
            `Made from your uploaded Word file (${cvSource.name}), edited in place. Fonts, sizes, layout, tables and margins are exactly as you made them. Only the text of the bullets you accepted changes.`}
          {isPdf &&
            (cvSource.style
              ? `Rebuilt as a Word file using the font (${cvSource.style.fontFamily}), sizes, bold headings and margins read from your PDF. This is a close match, not an identical copy: columns, colours, graphics and exact spacing aren't reproduced. For an exact match, upload the Word version of your CV.`
              : "I couldn't read the look of your PDF, so the file uses a plain layout. For an exact match, upload the Word version of your CV.")}
          {!cvSource &&
            "You pasted your CV as text, so there is no original look to match. The file uses a plain, ATS-friendly layout. For an exact match, upload your Word file instead."}
        </p>

        {isDocx && inPlace.status === "working" && <p className="mt-2 text-sm text-gray-500">Preparing your file…</p>}
        {isDocx && inPlace.status === "error" && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            I couldn&apos;t edit your original Word file. You can still download the plain version or copy the text.
          </p>
        )}
        {unmatched.length > 0 && (
          <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              {unmatched.length === 1 ? "One bullet" : `${unmatched.length} bullets`} left as in your original file:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {unmatched.map((u) => (
                <li key={u.id}>
                  Bullet {u.id}: {u.reason}
                </li>
              ))}
            </ul>
            <p className="mt-1">Copy the new wording from above into your file by hand, or use the plain version.</p>
          </div>
        )}
        {isDocx && inPlace.status === "ready" && inPlace.applied.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Longer or shorter rewrites can change where lines wrap and where pages break, so check the page count. If a
            font isn&apos;t installed on your computer, Word substitutes one, just as it does for your original.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void downloadPrimary()}
            disabled={primaryDisabled}
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy ? "Preparing…" : primaryLabel}
          </button>
          <button
            type="button"
            onClick={() => void downloadPlain()}
            disabled={noChanges || busy}
            className="rounded-lg border border-gray-300 px-5 py-2.5 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            Download plain ATS-friendly version
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={noChanges}
            className="rounded-lg border border-gray-300 px-5 py-2.5 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {copied ? "Copied" : "Copy as plain text"}
          </button>
        </div>
        {noChanges && accepted.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">Accept at least one rewrite to enable the downloads.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Your file is created in your browser. Nothing is sent anywhere or stored. If your original uses columns or
          tables, the new file keeps them, so it is only as ATS-friendly as your original. The plain version is the
          safest for ATS.
        </p>
      </section>

      <CoverLetterSection
        letter={letter}
        busy={letterBusy}
        error={letterError}
        acceptedCount={accepted.length}
        style={cvSource?.kind === "pdf" ? (cvSource.style ?? undefined) : undefined}
        onGenerate={onGenerateLetter}
        onChange={onLetterChange}
      />
    </div>
  );
}
