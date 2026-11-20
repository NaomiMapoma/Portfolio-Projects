import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import { wordDiff, type DiffPart } from "./wordDiff";

export type ReviewItem = {
  /** Stable key: the line id for a change, the order key for a move. */
  key: string;
  /** The number of the marker beside this line in the whole-CV view. */
  number: number;
  /** "Reworded", "Shortened", "Cut" or "Moved". */
  tag: string;
  /** A short label such as "Personal summary" (empty for an ordinary bullet). */
  title: string;
  why: string;
  /** Wording before and after. `after` is null for a cut. Empty for a move. */
  before: string;
  after: string | null;
  /** For a move: the bullets in the old and the new order. */
  orderBefore?: string[];
  orderAfter?: string[];
  needsLook: boolean;
  issues: string[];
  /** "your CV", "your answers" or "your notes". */
  sourceName: string;
  quote: string;
  styleNotes: string[];
  reverted: boolean;
  reviewed: boolean;
};

type Props = {
  items: ReviewItem[];
  index: number;
  safeLeft: number;
  needLookLeft: number;
  onIndex: (i: number, byKeyboard?: boolean) => void;
  onKeep: (key: string) => void;
  onToggleOriginal: (key: string, original: boolean) => void;
  onKeepAllSafe: () => void;
};

function Words({ parts, mode }: { parts: DiffPart[]; mode: "removed" | "added" }) {
  return (
    <>
      {parts.map((p, i) => {
        const sp = i > 0 ? " " : "";
        if (p.kind === "same") {
          return (
            <span key={i}>
              {sp + p.text}
              {p.mark && (
                <span className={mode === "removed" ? "bg-red-50 text-red-900 line-through decoration-2" : "bg-green-50 font-medium text-green-900 underline decoration-2 underline-offset-2"}>
                  <span className="sr-only">{mode === "removed" ? "removed: " : "added: "}</span>
                  {p.mark}
                </span>
              )}
            </span>
          );
        }
        if (p.kind === "moved") {
          return (
            <span key={i}>
              {sp}
              <span className="bg-blue-50 text-blue-900 underline decoration-dashed decoration-2 underline-offset-2">
                <span className="sr-only">moved: </span>
                {p.text}
              </span>
            </span>
          );
        }
        const cls = p.kind === mode && mode === "removed" ? "bg-red-50 text-red-900 line-through decoration-2" : "bg-green-50 font-medium text-green-900 underline decoration-2 underline-offset-2";
        return (
          <span key={i}>
            {sp}
            <span className={cls}>
              {mode === "removed" && <span className="sr-only">removed: </span>}
              {mode === "added" && <span className="sr-only">added: </span>}
              {p.text}
            </span>
          </span>
        );
      })}
    </>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-300 bg-white p-3">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <div className="mt-1 text-base leading-relaxed text-gray-900">{children}</div>
    </div>
  );
}

export default function ReviewPanel({ items, index, safeLeft, needLookLeft, onIndex, onKeep, onToggleOriginal, onKeepAllSafe }: Props) {
  const item = items[index];
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const diff = useMemo(() => (item && item.after !== null && !item.orderAfter ? wordDiff(item.before, item.after) : null), [item]);

  // After a move to another change, put focus on its heading so a screen reader reads it. Not on first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [index]);

  if (!item) return <p className="text-base text-gray-700">No lines needed changing.</p>;
  const last = index === items.length - 1;
  const go = (i: number) => {
    moved.current = true;
    onIndex(Math.min(items.length - 1, Math.max(0, i)), true);
  };
  const keep = () => {
    onKeep(item.key);
    if (!last) go(index + 1);
  };
  const toggle = () => {
    onToggleOriginal(item.key, !item.reverted);
    if (!item.reverted && !last) go(index + 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key.toLowerCase() === "k") keep();
    else if (e.key.toLowerCase() === "u") toggle();
    else return;
    e.preventDefault();
  };

  const isCut = item.tag === "Cut";
  return (
    <div role="region" aria-label="Review one change at a time" onKeyDown={onKeyDown} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 ref={heading} tabIndex={-1} className="text-lg font-semibold">
          Change {index + 1} of {items.length}
          {item.title ? `: ${item.title}` : ""}
        </h4>
        <div className="flex gap-2">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          <button type="button" onClick={() => go(index + 1)} disabled={last} className="min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
            Next
          </button>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded border border-gray-600 px-1.5 font-medium text-gray-800">{item.tag}</span>
        {item.needsLook && !item.reverted && <span className="rounded bg-amber-100 px-1.5 font-medium text-amber-900">{"! Needs a look"}</span>}
        {item.reverted && <span className="rounded border border-gray-600 px-1.5 font-medium text-gray-800">Your original is kept</span>}
        {item.reviewed && <span className="font-medium text-green-900">{"✓ Reviewed"}</span>}
        <span className="text-gray-600">Marker {item.number} in the whole CV</span>
      </p>
      <p className="text-base text-gray-800">{item.why}</p>

      {item.orderAfter ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Box title="Your original order">
            <ol className="list-decimal pl-5">
              {item.orderBefore?.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </Box>
          <Box title="New order">
            <ol className="list-decimal pl-5">
              {item.orderAfter.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </Box>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Box title="Your original">{diff ? <Words parts={diff.original} mode="removed" /> : <span className={isCut ? "line-through" : ""}>{item.before}</span>}</Box>
          <Box title={isCut ? "New wording" : "New wording"}>{isCut ? <span className="text-gray-700">This line is cut.</span> : diff ? <Words parts={diff.next} mode="added" /> : item.after}</Box>
        </div>
      )}
      <p className="text-sm text-gray-700">Removed words are struck through. Added words are underlined. Words that only moved have a dashed underline.</p>

      {item.needsLook && !item.reverted && item.issues.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3 text-base text-amber-900">
          <p className="font-medium">To check before you use this</p>
          <ul className="list-disc pl-5">
            {item.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {item.quote && (
        <details className="text-base text-gray-700">
          <summary className="min-h-10 cursor-pointer py-2">Source in {item.sourceName}</summary>
          <p>
            {"“"}
            {item.quote}
            {"”"}
          </p>
        </details>
      )}
      {item.styleNotes.length > 0 && !item.reverted && (
        <details className="text-base text-gray-700">
          <summary className="min-h-10 cursor-pointer py-2">Style note</summary>
          <p>{item.styleNotes.join(" ")}</p>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={keep} className="min-h-11 rounded-lg bg-accent px-4 py-2 font-medium text-white">
          {item.reverted ? "Keep my original" : last ? "Keep this change" : "Keep and next"}
        </button>
        <button type="button" onClick={toggle} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2 text-gray-800">
          {item.reverted ? (item.orderAfter ? "Use the new order" : "Use the new wording") : item.orderAfter ? "Use my original order" : "Use my original"}
        </button>
      </div>
      <p className="text-sm text-gray-600">Keys: left and right arrows for previous and next, K to keep, U to switch between the original and the new wording.</p>

      <div className="border-t border-gray-300 pt-3">
        <button
          type="button"
          onClick={onKeepAllSafe}
          disabled={safeLeft === 0}
          className="min-h-10 rounded-lg border border-gray-500 px-3 py-2 text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Keep all {safeLeft} safe {safeLeft === 1 ? "change" : "changes"}
        </button>
        <p className="mt-1 text-sm text-gray-600">
          {needLookLeft > 0 ? `${needLookLeft} that need a look ${needLookLeft === 1 ? "is" : "are"} left for you to check one by one.` : "Nothing is flagged."}
        </p>
      </div>
    </div>
  );
}
