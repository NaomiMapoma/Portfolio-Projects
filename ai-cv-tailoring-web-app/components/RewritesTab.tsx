import { useState } from "react";
import type { Rewrite, RewriteEdit, RoleContext, Voice } from "@/lib/types";

type Props = {
  rewrites: Rewrite[];
  roleContext?: RoleContext;
  voice?: Voice;
  edits: Record<string, RewriteEdit>;
  rejected: number;
  onChange: (id: string, patch: Partial<RewriteEdit>) => void;
};

const HAS_PLACEHOLDER = /\[[^\]]*\]/;

export default function RewritesTab({ rewrites, roleContext, voice, edits, rejected, onChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const acceptedCount = rewrites.filter((r) => edits[r.sourceBulletId]?.accepted).length;

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      setCopied(null); // clipboard blocked: the text can still be selected by hand
    }
  }

  return (
    <div>
      <p className="text-gray-700">
        Each suggestion is tailored to the role but uses only facts already in your CV. Where a number would
        help, you&apos;ll see a [placeholder]. Type your real figure over it, or leave the bullet as it is.
      </p>
      {roleContext && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium">How I read this role</p>
          <p className="mt-1">
            {roleContext.industry}, {roleContext.seniority}.
            {roleContext.priorities.length > 0 && <> It cares most about: {roleContext.priorities.join("; ")}.</>}
          </p>
          <p className="mt-1 text-gray-500">The suggestions below are tailored to this. If it is wrong, ignore them.</p>
        </div>
      )}
      {voice && voice.description && (
        <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium">How I read your writing</p>
          <p className="mt-1">
            {voice.description}
            {voice.favouriteVerbs.length > 0 && <> You often use: {voice.favouriteVerbs.join(", ")}.</>}
          </p>
          <p className="mt-1 text-gray-500">The suggestions and the cover letter try to match this. Edit anything that doesn&apos;t sound like you.</p>
        </div>
      )}
      <p className="mt-2 text-sm text-gray-500">
        {acceptedCount} of {rewrites.length} accepted
      </p>

      {rejected > 0 && (
        <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {rejected} {rejected === 1 ? "suggestion was" : "suggestions were"} removed because{" "}
          {rejected === 1 ? "it contained" : "they contained"} a number or source that isn&apos;t in your CV.
        </p>
      )}

      {rewrites.length === 0 ? (
        <p className="mt-6 text-gray-600">No rewrites to show for this CV.</p>
      ) : (
        <ul className="mt-6 space-y-8">
          {rewrites.map((r) => {
            const id = r.sourceBulletId;
            const edit = edits[id];
            if (!edit) return null;
            const text = edit[edit.mode];
            const supported = r.verification === "supported";

            return (
              <li key={id} className="rounded-xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gray-500">{r.kind === "summary" ? `Personal summary (${id})` : `Bullet ${id}`}</span>
                  <span
                    className={
                      supported
                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                        : "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
                    }
                  >
                    {supported ? "Supported by your CV" : "Check this claim"}
                  </span>
                </div>

                {!supported && r.issues.length > 0 && (
                  <ul className="mt-3 list-disc rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900">
                    {r.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}

                {r.styleNotes && r.styleNotes.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">Style: {r.styleNotes.join(" ")}</p>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium">Original</p>
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{r.original}</p>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor={`rw-${id}`} className="text-sm font-medium">
                        Suggestion (editable)
                      </label>
                      <div role="group" aria-label="Rewrite style" className="flex gap-1">
                        {(["light", "stronger"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={edit.mode === m}
                            onClick={() => onChange(id, { mode: m })}
                            className={
                              edit.mode === m
                                ? "rounded-lg border border-accent bg-accent px-2 py-1 text-xs text-white"
                                : "rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
                            }
                          >
                            {m === "light" ? "Light touch" : "Stronger impact"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      id={`rw-${id}`}
                      value={text}
                      onChange={(e) => onChange(id, { [edit.mode]: e.target.value })}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                    />
                    {HAS_PLACEHOLDER.test(text) && (
                      <p className="mt-1 text-xs text-amber-800">
                        Replace each [placeholder] with your real figure, or remove it, before you export.
                      </p>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-sm">
                  <span className="font-medium">What changed and why: </span>
                  {r.whatChanged}
                </p>

                {r.questionsForMe.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium">Questions for you</p>
                    <ul className="mt-1 list-disc pl-5 text-gray-700">
                      {r.questionsForMe.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={edit.accepted}
                      onChange={(e) => onChange(id, { accepted: e.target.checked })}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    Accept this rewrite
                  </label>
                  <button
                    type="button"
                    onClick={() => void copy(id, text)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    {copied === id ? "Copied" : "Copy"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
