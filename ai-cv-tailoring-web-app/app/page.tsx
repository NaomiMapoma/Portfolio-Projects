"use client";

import { useEffect, useState } from "react";
import type { LetterState } from "@/components/CoverLetterSection";
import InputsStep from "@/components/InputsStep";
import ResultsStep, { type TabId, type Usage } from "@/components/ResultsStep";
import type { CvSource } from "@/lib/export-style";
import type { AnalysisCore, RewriteEdit } from "@/lib/types";

type ApiResponse = {
  result?: AnalysisCore;
  usage?: Usage;
  dropped?: {
    strengths: number;
    gapEvidenceCleared: number;
    rewritesRejected: number;
    achievementsDropped: number;
    keywordsDemoted: number;
  };
  error?: string;
};

export default function Home() {
  // All state lives in memory only. Nothing is stored in the browser.
  // Results stay here, so switching tabs never triggers another API call.
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
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
  const [tab, setTab] = useState<TabId>("score");
  // Edits and accepts live here (not inside the tab), so they survive tab switches.
  const [rewriteEdits, setRewriteEdits] = useState<Record<string, RewriteEdit>>({});

  // Keywords the user ticked as "plan to add". A reminder only: never inserted into the export.
  const [keywordChoices, setKeywordChoices] = useState<Record<string, boolean>>({});

  // Cover letter: only generated when the user clicks. Kept here so it survives tab switches.
  const [letter, setLetter] = useState<LetterState | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterError, setLetterError] = useState("");

  async function generateLetter(writingSample: string) {
    if (!output?.result) return;
    setLetterBusy(true);
    setLetterError("");
    try {
      // Only the user's accepted rewrites (with their edits) are sent, plus the gap keywords to avoid.
      const accepted = output.result.rewrites
        .filter((r) => rewriteEdits[r.sourceBulletId]?.accepted)
        .map((r) => ({ id: r.sourceBulletId, text: rewriteEdits[r.sourceBulletId][rewriteEdits[r.sourceBulletId].mode] }));
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jd, accepted, gapKeywords: output.result.keywords.gaps, voice: output.result.voice, writingSample: writingSample.trim() || undefined }),
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

  function changeRewrite(id: string, patch: Partial<RewriteEdit>) {
    setRewriteEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function analyse() {
    setLoading(true);
    setError("");
    setOutput(null);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, jd }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error || !data.result) {
        setError(data.error ?? "Something went wrong running the analysis.");
      } else {
        setOutput(data);
        setTab("score");
        setKeywordChoices({});
        setLetter(null);
        setLetterError("");
        setRewriteEdits(
          Object.fromEntries(
            data.result.rewrites.map((r) => [
              r.sourceBulletId,
              { mode: "light", light: r.lightTouch, stronger: r.strongerImpact, accepted: false } satisfies RewriteEdit,
            ]),
          ),
        );
      }
    } catch {
      setError("Couldn't reach the app. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setOutput(null);
    setError("");
    setCv("");
    setJd("");
    setCvSource(null);
    setTab("score");
    setRewriteEdits({});
    setKeywordChoices({});
    setLetter(null);
    setLetterError("");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">FastTrack</h1>
        <p className="mt-1 text-gray-600">
          See how your real CV matches a job, and how to reword it honestly.
        </p>
      </header>

      {keyMissing && (
        <p role="alert" className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          No API key found. Copy <code>.env.local.example</code> to <code>.env.local</code>, add your{" "}
          <code>ANTHROPIC_API_KEY</code>, then restart the app. Analysis won&apos;t work until then.
        </p>
      )}

      {output?.result ? (
        <ResultsStep
          cv={cv}
          cvSource={cvSource}
          result={output.result}
          usage={output.usage}
          droppedStrengths={output.dropped?.strengths}
          rewritesRejected={output.dropped?.rewritesRejected}
          keywordsDemoted={output.dropped?.keywordsDemoted}
          rewriteEdits={rewriteEdits}
          onRewriteChange={changeRewrite}
          keywordChoices={keywordChoices}
          letter={letter}
          letterBusy={letterBusy}
          letterError={letterError}
          onGenerateLetter={(sample) => void generateLetter(sample)}
          onLetterChange={(text) => setLetter((prev) => (prev ? { ...prev, text } : prev))}
          onKeywordChoose={(keyword, chosen) => setKeywordChoices((prev) => ({ ...prev, [keyword]: chosen }))}
          tab={tab}
          onTabChange={setTab}
          onStartOver={startOver}
        />
      ) : (
        <>
          <InputsStep cv={cv} jd={jd} onCvChange={setCv} onCvSource={setCvSource} onJdChange={setJd} onAnalyse={analyse} analysing={loading} />
          {loading && (
            <p role="status" className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Analysing your CV against the job description. This usually takes under a minute.
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
  );
}
