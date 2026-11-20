import { useMemo, useState, type ReactNode } from "react";
import { splitCv } from "@/lib/bullets";
import { applyDraft, orderKey } from "@/lib/draft-apply";
import type { DraftChange, DraftMove, DraftRejection } from "@/lib/draft-types";
import { buildExport, type ExportLine } from "@/lib/export";
import type { PlanItem } from "@/lib/assess-types";
import type { CvSource } from "@/lib/export-style";
import { MAX_FEEDBACK_CHARS } from "@/lib/feedback-limit";
import DownloadBar from "./DownloadBar";
import ReviewPanel, { type ReviewItem } from "./ReviewPanel";

type Props = {
  cv: string;
  cvSource: CvSource;
  changes: DraftChange[];
  moves: DraftMove[];
  /** Why a confirmed term was not added to the skills line. Empty if nothing needs saying. */
  skillsNote: string;
  rejections: DraftRejection[];
  /** Plan bullets that ask for a reorder. Shown as not applied only if no reorder was made. */
  reorders: PlanItem[];
  /** Lines the user has put back to the original wording. */
  useOriginal: Record<string, boolean>;
  onUseOriginal: (id: string, original: boolean) => void;
  /** Redraft the whole CV with the user's instruction. */
  onRework: (feedback: string) => void;
  reworking: boolean;
  reworkError: string;
};

const unchanged = (c: DraftChange) => c.action !== "cut" && c.newText === c.original;

function sourceText(c: DraftChange): string {
  if (c.source === "CV") return "your CV";
  if (c.source === "Notes") return "your notes";
  if (c.source === "Your answers") return "your answers";
  const m = c.source.match(/^Answer (\d+)$/);
  return m ? `your answer to question ${m[1]}` : c.source;
}

function labelOf(c: DraftChange): string {
  if (c.kind === "summary") return "Personal summary";
  if (c.kind === "skills") return "Skills line";
  const t = c.original;
  return t.length > 60 ? `${t.slice(0, 60).trimEnd()}…` : t;
}

const ACTION_WORD = { reword: "Reworded", shorten: "Shortened", cut: "Cut" } as const;

// A job line such as "Programme Manager, Example Council, 2019 to 2024" is shown with its dates on the right.
const DATED = /^(.*?)[,\s]+((?:[A-Za-z]{3,9}\s)?\d{4}\s*(?:to|-|–|—)\s*(?:(?:[A-Za-z]{3,9}\s)?\d{4}|present|current))$/i;

function Marker({ state, n }: { state: "changed" | "removed" | "check"; n?: number }) {
  const word = state === "changed" ? "Changed" : state === "removed" ? "Cut" : "Needs a look";
  const icon = state === "changed" ? "✓" : state === "removed" ? "✕" : "!";
  const cls = state === "changed" ? "bg-green-800" : state === "removed" ? "bg-gray-700" : "bg-amber-800";
  return (
    <span className={`absolute -left-8 top-1 flex h-5 min-w-7 items-center justify-center gap-0.5 rounded-full px-1 font-sans text-[11px] font-bold leading-none text-white ${cls}`}>
      {n !== undefined && <span aria-hidden="true">{n}</span>}
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">
        {n !== undefined ? `Note ${n}, ` : ""}
        {word}:{" "}
      </span>
    </span>
  );
}

// The CV as a page, one grid row per line: the line on the left (white, like paper) and, where one explains it, its note
// on the right. On a narrow screen the note sits under its line.
function CvPage({ lines, flagged, numbers, noteAt }: { lines: ExportLine[]; flagged: Set<string>; numbers: Map<string, number>; noteAt: Map<string, ReactNode> }) {
  // Lines before the first heading are the name and contact details; the first of them is the name.
  const firstHeading = lines.findIndex((l) => l.kind === "heading");
  const topEnd = firstHeading === -1 ? lines.length : firstHeading;
  const nameAt = lines.findIndex((l) => l.kind !== "blank");
  const hasNotes = noteAt.size > 0;
  const row = (key: number, left: ReactNode, id?: string) => {
    const note = id ? noteAt.get(id) : undefined;
    return (
      <div key={key} className={hasNotes ? "md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}>
        <div className="bg-white pl-9 pr-2 font-serif sm:pl-10 sm:pr-6 text-[15px] leading-snug text-[#1b1b1b]">{left}</div>
        {note && <div className="bg-gray-50 px-3 pb-2 pt-0 font-sans md:border-l md:border-gray-300">{note}</div>}
        {!note && hasNotes && <div className="hidden bg-gray-50 md:block md:border-l md:border-gray-300" aria-hidden="true" />}
      </div>
    );
  };
  return (
    <div>
      {row(-1, <div className="h-4" aria-hidden="true" />)}
      {lines.map((l, i) => {
        if (l.kind === "blank") return row(i, <div className="h-2" aria-hidden="true" />);
        if (l.kind === "heading") {
          return row(
            i,
            // The CV's own section titles are part of the document preview, not headings of this page.
            <p className="mb-1 mt-4 border-b border-[#1b1b1b] pb-0.5 text-sm font-bold uppercase tracking-wider">{l.text}</p>,
          );
        }
        const state = l.state === "removed" ? "removed" : l.id && flagged.has(l.id) ? "check" : l.state === "changed" ? "changed" : null;
        const tint = state === "changed" ? "bg-[#e3f2e3]" : state === "check" ? "bg-[#fff0c8]" : "";
        const wrap = `relative rounded-sm px-1 py-0.5 ${tint}`;
        const marker = state ? <Marker state={state} n={l.id ? numbers.get(l.id) : undefined} /> : null;
        const anchor = l.id ? { id: `cvl-${l.id}`, tabIndex: -1 } : {};
        const struck = l.state === "removed" ? "text-[#595959] line-through" : "";

        if (i < topEnd) {
          return row(
            i,
            <p className={i === nameAt ? "text-center text-2xl" : "text-center text-sm text-[#444]"}>{l.text}</p>,
          );
        }
        if (l.kind === "bullet") {
          return row(
            i,
            <div {...anchor} className={`${wrap} flex gap-2 ${struck}`}>
              {marker}
              <span aria-hidden="true">{"•"}</span>
              <span>{l.text}</span>
            </div>,
            l.id,
          );
        }
        const dated = l.text.match(DATED);
        if (dated) {
          return row(
            i,
            <div {...anchor} className={`${wrap} mt-2 flex justify-between gap-3 font-bold ${struck}`}>
              {marker}
              <span>{dated[1]}</span>
              <span className="font-normal text-[#444] sm:whitespace-nowrap">{dated[2]}</span>
            </div>,
            l.id,
          );
        }
        return row(
          i,
          <p {...anchor} className={`${wrap} ${struck}`}>
            {marker}
            {l.text}
          </p>,
          l.id,
        );
      })}
      {row(-2, <div className="h-4" aria-hidden="true" />)}
    </div>
  );
}

export default function DraftView({ cv, cvSource, changes, moves, skillsNote, rejections, reorders, useOriginal, onUseOriginal, onRework, reworking, reworkError }: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  // Review one change at a time (default) or look at the whole CV. Only ids are kept here, never CV text.
  const [view, setView] = useState<"review" | "whole">("review");
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [announce, setAnnounce] = useState("");
  // Typed here and cleared when a new draft arrives (this view is re-keyed by the page).
  const [feedback, setFeedback] = useState("");
  const bullets = useMemo(() => splitCv(cv).bullets, [cv]);
  const accepted = useMemo(() => applyDraft(changes, moves, useOriginal, bullets), [changes, moves, useOriginal, bullets]);
  const textOf = (id: string) => bullets.find((b) => b.id === id)?.text ?? "";
  const flagged = useMemo(() => new Set(changes.filter((c) => c.verification === "check" && !useOriginal[c.id]).map((c) => c.id)), [changes, useOriginal]);
  const lines = useMemo(() => buildExport(cv, showOriginal ? [] : accepted, { markRemoved: true }).lines, [cv, accepted, showOriginal]);
  const shown = changes.filter((c) => !unchanged(c) || c.verification === "check");
  // One numbered note per change or move, in the order it appears in the CV, so a note matches the marker beside its line.
  const { notes, numbers } = useMemo(() => {
    const pos = new Map(bullets.map((b, i) => [b.id, i]));
    const at = (id: string) => pos.get(id) ?? 0;
    const all: ({ kind: "move"; m: DraftMove; anchor: string } | { kind: "change"; c: DraftChange; anchor: string })[] = [
      ...moves.map((m) => ({ kind: "move" as const, m, anchor: m.original[0] ?? m.key })),
      ...changes.filter((c) => !unchanged(c) || c.verification === "check").map((c) => ({ kind: "change" as const, c, anchor: c.id })),
    ].sort((a, b) => at(a.anchor) - at(b.anchor));
    const nums = new Map<string, number>();
    all.forEach((e, i) => {
      if (e.kind === "move") e.m.original.forEach((id) => nums.set(id, i + 1));
      else nums.set(e.c.id, i + 1);
    });
    return { notes: all, numbers: nums };
  }, [bullets, moves, changes]);
  const card = (e: (typeof notes)[number], ni: number) => {
    const n = ni + 1;
    if (e.kind === "move") {
      const m = e.m;
      const reverted = !!useOriginal[orderKey(m)];
      return (
        <div id={`note-${n}`} className="rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{n}.</span>
            <span className="rounded border border-gray-600 px-1.5 text-sm font-medium text-gray-800">Moved</span>
            <span className="font-medium">Bullet order</span>
          </p>
          {reverted ? (
            <p className="mt-2 text-gray-700">Your original order is kept.</p>
          ) : (
            <>
              <p className="mt-1 text-gray-800">{m.whatChanged}</p>
              <details className="mt-1 text-gray-700">
                <summary className="min-h-10 cursor-pointer py-2">New order</summary>
                <ol className="list-decimal pl-5">
                  {m.ids.map((id) => (
                    <li key={id}>{textOf(id).length > 60 ? `${textOf(id).slice(0, 60).trimEnd()}\u2026` : textOf(id)}</li>
                  ))}
                </ol>
              </details>
            </>
          )}
          <button
            type="button"
            onClick={() => onUseOriginal(orderKey(m), !reverted)}
            className="mt-2 min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800"
          >
            {reverted ? "Use the new order" : "Use my original order"}
          </button>
        </div>
      );
    }
    const c = e.c;
    const reverted = !!useOriginal[c.id];
    const flags = c.verification === "check" && !reverted;
    return (
      <div id={`note-${n}`} className="rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{n}.</span>
          <span className="rounded border border-gray-600 px-1.5 text-sm font-medium text-gray-800">{ACTION_WORD[c.action]}</span>
          {c.kind && <span className="font-medium">{labelOf(c)}</span>}
        </p>
        {reverted ? (
          <p className="mt-2 text-gray-700">Your original wording is kept.</p>
        ) : (
          <>
            <p className="mt-1 text-gray-800">{c.whatChanged}</p>
            {c.evidenceQuote ? (
              <details className="mt-1 text-gray-600">
                <summary className="min-h-10 cursor-pointer py-2">Source in {sourceText(c)}</summary>
                <p>
                  {"“"}
                  {c.evidenceQuote}
                  {"”"}
                </p>
              </details>
            ) : (
              c.kind === "skills" && <p className="mt-1 text-gray-600">Based on {sourceText(c)}.</p>
            )}
          </>
        )}
        {flags && c.issues.length > 0 && (
          <div className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900">
            <p className="font-medium">To check before you use this</p>
            <ul className="list-disc pl-5">
              {c.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {c.styleNotes && c.styleNotes.length > 0 && !reverted && <p className="mt-1 text-gray-600">Style: {c.styleNotes.join(" ")}</p>}
        <button
          type="button"
          onClick={() => onUseOriginal(c.id, !reverted)}
          className="mt-2 min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800"
        >
          {reverted ? "Use the new wording" : "Use my original"}
        </button>
      </div>
    );
  };
  // Notes by the line they sit beside. Two notes on one line stack.
  const noteAt = new Map<string, ReactNode>();
  notes.forEach((e, ni) => {
    const prev = noteAt.get(e.anchor);
    noteAt.set(
      e.anchor,
      prev ? (
        <div className="space-y-3">
          {prev}
          {card(e, ni)}
        </div>
      ) : (
        card(e, ni)
      ),
    );
  });
  const keyOf = (e: (typeof notes)[number]) => (e.kind === "move" ? orderKey(e.m) : e.c.id);
  const short = (t: string) => (t.length > 80 ? `${t.slice(0, 80).trimEnd()}\u2026` : t);
  // The review queue: changes that need a look first, then CV order. Fixed when the draft arrives, so it does not
  // jump around while the reader decides.
  const queue = useMemo(() => {
    const flaggedFirst = notes.map((e, ni) => ({ e, ni })).sort((a, b) => Number(b.e.kind === "change" && b.e.c.verification === "check") - Number(a.e.kind === "change" && a.e.c.verification === "check") || a.ni - b.ni);
    return flaggedFirst;
  }, [notes]);
  const items: ReviewItem[] = queue.map(({ e, ni }) => {
    const key = keyOf(e);
    if (e.kind === "move") {
      return {
        key,
        number: ni + 1,
        tag: "Moved",
        title: "Bullet order",
        why: e.m.whatChanged,
        before: "",
        after: "",
        orderBefore: e.m.original.map((id) => short(textOf(id))),
        orderAfter: e.m.ids.map((id) => short(textOf(id))),
        needsLook: false,
        issues: [],
        sourceName: "",
        quote: "",
        styleNotes: [],
        reverted: !!useOriginal[key],
        reviewed: reviewed.has(key),
      };
    }
    const c = e.c;
    return {
      key,
      number: ni + 1,
      tag: ACTION_WORD[c.action],
      title: c.kind ? labelOf(c) : "",
      why: c.whatChanged,
      before: c.original,
      after: c.action === "cut" ? null : c.newText,
      needsLook: c.verification === "check",
      issues: c.issues,
      sourceName: sourceText(c),
      quote: c.evidenceQuote,
      styleNotes: c.styleNotes ?? [],
      reverted: !!useOriginal[key],
      reviewed: reviewed.has(key),
    };
  });
  const safeLeft = items.filter((i) => !i.needsLook && !i.reviewed).length;
  const needLookLeft = items.filter((i) => i.needsLook && !i.reviewed && !i.reverted).length;
  const reviewedCount = items.filter((i) => i.reviewed).length;
  const markReviewed = (keys: string[]) => setReviewed((prev) => new Set([...prev, ...keys]));
  const goToDownload = () => {
    const el = document.getElementById("dl-heading");
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  };
  const applied = accepted.length;
  const toCheck = changes.filter((c) => c.verification === "check" && !useOriginal[c.id]).length;

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-300 bg-white px-1 py-2 text-base text-gray-900">
        <p>
          <span className="font-medium">{items.length} {items.length === 1 ? "change" : "changes"}</span>
          <span aria-hidden="true">{" | "}</span>
          <span className={toCheck > 0 ? "font-medium text-amber-900" : ""}>{toCheck > 0 ? `! ${toCheck} need a look` : "Nothing needs a look"}</span>
          <span aria-hidden="true">{" | "}</span>
          <span>
            {reviewedCount} of {items.length} reviewed
          </span>
        </p>
        <button type="button" onClick={goToDownload} className="min-h-10 rounded-lg bg-accent px-4 py-2 font-medium text-white">
          Download
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <section aria-labelledby="dv-heading">
        <h3 id="dv-heading" className="text-lg font-semibold">
          Your tailored draft
        </h3>
        <p className="mt-1 text-base text-gray-700">
          {applied} {applied === 1 ? "line has" : "lines have"} changed. Everything else is exactly as you wrote it.
          {toCheck > 0 && ` ${toCheck} ${toCheck === 1 ? "needs" : "need"} a look before you download.`}
        </p>

        {rejections.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
            <p className="font-medium">
              {rejections.length === 1 ? "One suggestion was" : `${rejections.length} suggestions were`} left out to keep your CV honest:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {rejections.map((r, i) => (
                <li key={i}>
                  {r.label}: {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        {skillsNote && (
          <p role="note" className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
            {skillsNote}
          </p>
        )}
        {reorders.length > 0 && moves.length === 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
            <p className="font-medium">I didn&apos;t reorder anything this time, so these ideas are not applied:</p>
            <ul className="mt-1 list-disc pl-5">
              {reorders.map((r, i) => (
                <li key={i}>
                  {r.label}: {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold">Check the changes</h4>
          <div role="group" aria-label="How to look at the changes" className="flex gap-2">
            {(["review", "whole"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={view === v ? "min-h-10 rounded-lg border border-accent bg-accent px-3 py-2 text-sm text-white" : "min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800"}
              >
                {v === "review" ? "Review one by one" : "Whole CV"}
              </button>
            ))}
          </div>
        </div>

        {view === "review" && (
          <div className="mt-3 rounded-lg border border-gray-300 p-3 sm:p-4">
            <ReviewPanel
              items={items}
              index={Math.min(index, Math.max(0, items.length - 1))}
              safeLeft={safeLeft}
              needLookLeft={needLookLeft}
              onIndex={(i) => {
                setIndex(i);
              }}
              onKeep={(key) => {
                markReviewed([key]);
                setAnnounce(`Kept. ${reviewedCount + 1} of ${items.length} reviewed.`);
              }}
              onToggleOriginal={(key, original) => {
                onUseOriginal(key, original);
                markReviewed([key]);
                setAnnounce(original ? "Your original wording is kept for this change." : "The new wording is used for this change.");
              }}
              onKeepAllSafe={() => {
                markReviewed(items.filter((i) => !i.needsLook).map((i) => i.key));
                setAnnounce(`${safeLeft} safe ${safeLeft === 1 ? "change" : "changes"} kept. ${needLookLeft} still to check.`);
              }}
            />
          </div>
        )}

        {view === "whole" && <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-700">{showOriginal ? "Your original CV." : "Each note sits beside the line it explains. The number on the note matches the marker on the line."}</p>
            <div role="group" aria-label="Which version to show" className="flex gap-2">
              {([false, true] as const).map((o) => (
                <button
                  key={String(o)}
                  type="button"
                  aria-pressed={showOriginal === o}
                  onClick={() => setShowOriginal(o)}
                  className={
                    showOriginal === o
                      ? "min-h-10 rounded-lg border border-accent bg-accent px-3 py-2 text-sm text-white"
                      : "min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800"
                  }
                >
                  {o ? "Original" : "Tailored"}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-gray-100 p-3 sm:p-4">
            <div className="overflow-hidden rounded border border-gray-300 shadow-sm" role="region" aria-label={showOriginal ? "Your original CV" : "Your tailored CV and notes"}>
              <CvPage lines={lines} flagged={flagged} numbers={showOriginal ? new Map() : numbers} noteAt={showOriginal ? new Map() : noteAt} />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            A plain view of your CV. Your real fonts and layout are kept in the file you download. Markers: <span aria-hidden="true">{"✓"}</span> changed,{" "}
            <span aria-hidden="true">!</span> needs a look, <span aria-hidden="true">{"✕"}</span> cut.
          </p>
          {!showOriginal && shown.length === 0 && moves.length === 0 && <p className="mt-2 text-sm text-gray-700">No lines needed changing.</p>}
        </div>}
      </section>

      <section aria-labelledby="rw-heading" className="rounded-xl border border-gray-500 p-4 sm:p-6">
        <h3 id="rw-heading" className="text-lg font-semibold">
          Want it changed?
        </h3>
        <label htmlFor="rw-box" className="mt-2 block text-base text-gray-800">
          Tell me what to change and I&apos;ll redraft the whole CV.
        </label>
        <textarea
          id="rw-box"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value.slice(0, MAX_FEEDBACK_CHARS))}
          rows={3}
          placeholder="For example: shorter, lead with stakeholders, cut the retail line too"
          className="mt-2 w-full rounded-lg border border-gray-500 p-3 text-base"
        />
        <p className="mt-1 text-sm text-gray-600">
          {feedback.length} of {MAX_FEEDBACK_CHARS} characters. Reworking replaces this draft and uses more tokens. Lines you put back to your original stay as they are. It can&apos;t add facts you haven&apos;t given me.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onRework(feedback.trim())}
            disabled={reworking || feedback.trim() === ""}
            className="min-h-11 rounded-lg bg-accent px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {reworking ? "Reworking…" : "Rework the draft"}
          </button>
        </div>
        {reworking && (
          <p role="status" className="mt-3 text-sm text-gray-700">
            Redrafting your CV and checking every line. This usually takes under a minute.
          </p>
        )}
        {reworkError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            {reworkError}
          </p>
        )}
      </section>

      <DownloadBar cv={cv} cvSource={cvSource} accepted={accepted} />
    </div>
  );
}
