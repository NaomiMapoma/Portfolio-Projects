"use client";

import { useEffect, useState } from "react";
import AssessmentView from "@/components/AssessmentView";
import CoverLetterSection, { type LetterState } from "@/components/CoverLetterSection";
import DraftView from "@/components/DraftView";
import InputsStep from "@/components/InputsStep";
import QuestionsForm from "@/components/QuestionsForm";
import type { Assessment } from "@/lib/assess-types";
import { splitCv } from "@/lib/bullets";
import { applyDraft } from "@/lib/draft-apply";
import type { DraftChange, DraftMove, DraftRejection } from "@/lib/draft-types";
import type { CvSource } from "@/lib/export-style";

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

type ApiResponse = {
  assessment?: Assessment;
  usage?: Usage;
  error?: string;
};

type DraftResponse = {
  changes?: DraftChange[];
  moves?: DraftMove[];
  skillsNote?: string;
  rejections?: DraftRejection[];
  usage?: Usage;
  error?: string;
};

const STEPS = ["Inputs", "Assessment", "Draft"] as const;

const addUsage = (a: Usage | undefined, b: Usage | undefined): Usage | undefined =>
  !a || !b ? (a ?? b) : { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };

export default function Home() {
  // All state lives in memory only. Nothing is stored in the browser.
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");
  // Where the CV came from (kept in memory only), so the export can keep its look.
  const [cvSource, setCvSource] = useState<CvSource>(null);
  // Whether an API key is set (asked once on load; the answer is a plain yes or no).
  const [keyMissing, setKeyMissing] = useState(false);
  useEffect(() => {
    let off = false;
    fetch("/api/health")
      .then((r) => r.json() as Promise<{ keyConfigured?: boolean }>)
      .then((d) => {
        if (!off && d.keyConfigured === false) setKeyMissing(true);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<ApiResponse | null>(null);

  // The user's answers to the clarifying questions. Skipped or empty answers are never sent on.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  // The draft: changed lines only, and any the user has put back to their original wording.
  const [draftResult, setDraftResult] = useState<{ changes: DraftChange[]; moves: DraftMove[]; skillsNote: string; rejections: DraftRejection[]; usage?: Usage } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [useOriginal, setUseOriginal] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"assessment" | "draft">("assessment");
  // Tokens used by every draft and rework so far (the draft is replaced each time, the cost is not).
  const [draftUsage, setDraftUsage] = useState<Usage | undefined>(undefined);

  // The cover letter is only written when the user clicks. Kept here so it survives moving between steps.
  const [letter, setLetter] = useState<LetterState | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterError, setLetterError] = useState("");

  const assessment = output?.assessment;
  const showDraft = !!draftResult && view === "draft";
  const step = showDraft ? 2 : assessment ? 1 : 0;

  async function runAssessment() {
    setLoading(true);
    setError("");
    setOutput(null);
    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jd, notes: notes.trim() || undefined }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error || !data.assessment) {
        setError(data.error ?? "Something went wrong running the assessment.");
      } else {
        setOutput(data);
        setAnswers({});
        setSkipped({});
        setDraftResult(null);
        setDraftError("");
        setUseOriginal({});
        setView("assessment");
        setDraftUsage(undefined);
        setLetter(null);
        setLetterError("");
      }
    } catch {
      setError("Couldn't reach the app. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Only answered, unskipped questions are ever sent on.
  function answeredQuestions() {
    return (assessment?.questions ?? [])
      .filter((q) => !skipped[q.id] && (answers[q.id] ?? "").trim())
      .map((q) => ({ id: q.id, question: q.text, answer: (answers[q.id] ?? "").trim() }));
  }

  // One request for both the first draft and a rework. A rework sends the previous draft and the user's instruction.
  async function requestDraft(feedback?: string) {
    if (!assessment) return;
    setDrafting(true);
    setDraftError("");
    try {
      const rework = !!feedback && !!draftResult;
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv,
          jd,
          notes: notes.trim() || undefined,
          answers: answeredQuestions(),
          context: { roleContext: assessment.roleContext, voice: assessment.voice, plan: assessment.plan, requirements: assessment.requirements },
          ...(rework && draftResult
            ? {
                previous: draftResult.changes
                  .filter((c) => !useOriginal[c.id] && !(c.action !== "cut" && c.newText === c.original))
                  .map((c) => ({ id: c.id, action: c.action, newText: c.newText })),
                feedback,
                keepOriginal: Object.keys(useOriginal).filter((id) => useOriginal[id]),
                previousOrder: draftResult.moves.filter((m) => !useOriginal[`order:${m.key}`]).map((m) => m.ids.join(",")),
              }
            : {}),
        }),
      });
      const data = (await res.json()) as DraftResponse;
      if (!res.ok || data.error || !data.changes) {
        setDraftError(data.error ?? "Something went wrong drafting your CV.");
      } else {
        setDraftResult({ changes: data.changes, moves: data.moves ?? [], skillsNote: data.skillsNote ?? "", rejections: data.rejections ?? [], usage: data.usage });
        setDraftUsage((prev) => addUsage(prev, data.usage));
        setUseOriginal({});
        setView("draft");
        setLetter(null); // a letter written from the old draft is out of date
      }
    } catch {
      setDraftError("Couldn't reach the app. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function runDraft() {
    await requestDraft();
  }

  async function runRework(feedback: string) {
    await requestDraft(feedback);
  }

  async function generateLetter(writingSample: string) {
    if (!assessment || !draftResult) return;
    setLetterBusy(true);
    setLetterError("");
    try {
      // The lines the user is keeping (not cuts, and not the skills line, which is a list and not prose).
      const skillsId = draftResult.changes.find((c) => c.kind === "skills")?.id;
      const accepted = applyDraft(draftResult.changes, draftResult.moves, useOriginal, splitCv(cv).bullets)
        .filter((a) => !a.remove && a.id !== skillsId)
        .slice(0, 10)
        .map((a) => ({ id: a.id, text: a.text }));
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv,
          jd,
          accepted,
          answers: answeredQuestions(),
          notes: notes.trim() || undefined,
          gapKeywords: assessment.requirements.filter((r) => r.status === "no" && r.requirement.length <= 80).map((r) => r.requirement),
          roleContext: assessment.roleContext,
          voice: assessment.voice,
          writingSample: writingSample.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        letter?: string;
        verification?: "supported" | "check";
        issues?: string[];
        styleNotes?: string[];
        acceptedUsed?: number;
        usage?: { input: number; output: number };
        error?: string;
      };
      if (!res.ok || data.error || !data.letter) {
        setLetterError(data.error ?? "Something went wrong writing the cover letter.");
      } else {
        setLetter({
          text: data.letter,
          generated: data.letter,
          verification: data.verification ?? "check",
          issues: data.issues ?? [],
          styleNotes: data.styleNotes ?? [],
          acceptedUsed: data.acceptedUsed ?? 0,
          usage: data.usage ?? { input: 0, output: 0 },
        });
      }
    } catch {
      setLetterError("Couldn't reach the app. Please try again.");
    } finally {
      setLetterBusy(false);
    }
  }

  function startOver() {
    setOutput(null);
    setError("");
    setCv("");
    setJd("");
    setNotes("");
    setCvSource(null);
    setAnswers({});
    setSkipped({});
    setDraftResult(null);
    setDraftError("");
    setUseOriginal({});
    setView("assessment");
    setDraftUsage(undefined);
    setLetter(null);
    setLetterError("");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">FastTrack</h1>
        <p className="mt-1 text-gray-600">See how your real CV matches a job, and tailor it honestly.</p>
      </header>

      <ol aria-label="Progress" className="mb-8 flex flex-wrap gap-2 text-sm">
        {STEPS.map((name, i) => (
          <li
            key={name}
            aria-current={i === step ? "step" : undefined}
            className={
              i === step
                ? "rounded-full bg-accent px-3 py-1 font-medium text-white"
                : "rounded-full border border-gray-300 px-3 py-1 text-gray-600"
            }
          >
            {i + 1} {name}
          </li>
        ))}
      </ol>

      <main id="main" tabIndex={-1} className="outline-none">
      {keyMissing && (
        <p role="alert" className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          No API key found. Copy <code>.env.local.example</code> to <code>.env.local</code>, add your{" "}
          <code>ANTHROPIC_API_KEY</code>, then restart the app. The assessment won&apos;t work until then.
        </p>
      )}

      {assessment ? (
        <section aria-labelledby="results-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-heading" className="text-2xl font-semibold">
              {showDraft ? "Step 3: Draft" : "Step 2: Assessment"}
            </h2>
            <div className="flex gap-2">
              {showDraft && (
                <button type="button" onClick={() => setView("assessment")} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2">
                  Back to assessment
                </button>
              )}
              {!showDraft && draftResult && (
                <button type="button" onClick={() => setView("draft")} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2">
                  Back to draft
                </button>
              )}
              <button type="button" onClick={startOver} className="min-h-11 rounded-lg border border-gray-500 px-4 py-2">
                Start over
              </button>
            </div>
          </div>

          {showDraft && draftResult ? (
            <div className="space-y-8">
            <DraftView
              key={draftUsage ? `${draftUsage.input}-${draftUsage.output}` : "draft"}
              cv={cv}
              cvSource={cvSource}
              changes={draftResult.changes}
              moves={draftResult.moves}
              skillsNote={draftResult.skillsNote}
              rejections={draftResult.rejections}
              reorders={assessment.plan.filter((p) => p.action === "reorder")}
              useOriginal={useOriginal}
              onUseOriginal={(id, original) => setUseOriginal((prev) => ({ ...prev, [id]: original }))}
              onRework={runRework}
              reworking={drafting}
              reworkError={draftError}
            />
            <CoverLetterSection
              letter={letter}
              busy={letterBusy}
              error={letterError}
              acceptedCount={applyDraft(draftResult.changes, draftResult.moves, useOriginal, splitCv(cv).bullets).filter((a) => !a.remove && a.id !== draftResult.changes.find((c) => c.kind === "skills")?.id).length}
              style={cvSource?.kind === "pdf" ? (cvSource.style ?? undefined) : undefined}
              onGenerate={(sample) => void generateLetter(sample)}
              onChange={(text) => setLetter((prev) => (prev ? { ...prev, text } : prev))}
            />
            </div>
          ) : (
            <div className="space-y-10 rounded-xl border border-gray-200 p-4 sm:p-6">
              <AssessmentView assessment={assessment} />
              <QuestionsForm
                questions={assessment.questions}
                answers={answers}
                skipped={skipped}
                onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
                onSkip={(id, value) => setSkipped((prev) => ({ ...prev, [id]: value }))}
                onDraft={runDraft}
                drafting={drafting}
                hasDraft={!!draftResult}
              />
              {drafting && (
                <p role="status" className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  Drafting your CV and checking every line against your CV and answers. This usually takes under a minute.
                </p>
              )}
              {draftError && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
                  {draftError}
                </p>
              )}
            </div>
          )}

          {output?.usage && (
            <p className="mt-4 text-sm text-gray-600">
              {(() => {
                const u = addUsage(output.usage, draftUsage) ?? output.usage;
                return `Tokens used this run: ${u.input.toLocaleString("en-GB")} in, ${u.output.toLocaleString("en-GB")} out${u.cacheRead > 0 ? ` (${u.cacheRead.toLocaleString("en-GB")} read from cache)` : ""}`;
              })()}
            </p>
          )}
        </section>
      ) : (
        <>
          <InputsStep
            cv={cv}
            jd={jd}
            notes={notes}
            onNotesChange={setNotes}
            onCvChange={setCv}
            onCvSource={setCvSource}
            onJdChange={setJd}
            onAnalyse={runAssessment}
            analysing={loading}
          />
          {loading && (
            <p role="status" className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Reading your CV against the job description. This usually takes under a minute.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
        </>
      )}
      </main>
    </div>
  );
}
