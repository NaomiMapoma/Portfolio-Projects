import type { CvSource } from "@/lib/export-style";
import type { AnalysisCore, RewriteEdit } from "@/lib/types";
import type { LetterState } from "./CoverLetterSection";
import ExportTab from "./ExportTab";
import KeywordsTab from "./KeywordsTab";
import RewritesTab from "./RewritesTab";
import ScoreTab from "./ScoreTab";
import StrengthsGapsTab from "./StrengthsGapsTab";

export const TABS = [
  { id: "score", label: "Score" },
  { id: "strengths", label: "Strengths and Gaps" },
  { id: "rewrites", label: "Rewrites" },
  { id: "keywords", label: "Keywords" },
  { id: "export", label: "Export" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

type Props = {
  cv: string;
  cvSource: CvSource;
  result: AnalysisCore;
  usage?: Usage;
  droppedStrengths?: number;
  rewritesRejected?: number;
  keywordsDemoted?: number;
  rewriteEdits: Record<string, RewriteEdit>;
  onRewriteChange: (id: string, patch: Partial<RewriteEdit>) => void;
  keywordChoices: Record<string, boolean>;
  letter: LetterState | null;
  letterBusy: boolean;
  letterError: string;
  onGenerateLetter: (writingSample: string) => void;
  onLetterChange: (text: string) => void;
  onKeywordChoose: (keyword: string, chosen: boolean) => void;
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  onStartOver: () => void;
};

export default function ResultsStep({
  cv,
  cvSource,
  result,
  usage,
  droppedStrengths = 0,
  rewritesRejected = 0,
  keywordsDemoted = 0,
  rewriteEdits,
  onRewriteChange,
  keywordChoices,
  letter,
  letterBusy,
  letterError,
  onGenerateLetter,
  onLetterChange,
  onKeywordChoose,
  tab,
  onTabChange,
  onStartOver,
}: Props) {
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <section aria-labelledby="results-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="results-heading" className="text-lg font-semibold">
          Step 2: Results
        </h2>
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          Start over
        </button>
      </div>

      <div role="tablist" aria-label="Results" className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls={`panel-${t.id}`}
            onClick={() => onTabChange(t.id)}
            className={
              t.id === tab
                ? "-mb-px border-b-2 border-accent px-4 py-2 font-medium text-accent"
                : "-mb-px border-b-2 border-transparent px-4 py-2 text-gray-600"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        className="mt-6 rounded-xl border border-gray-200 p-6"
      >
        {active.id === "score" && <ScoreTab scores={result.scores} />}
        {active.id === "strengths" && <StrengthsGapsTab result={result} />}
        {active.id === "rewrites" && (
          <RewritesTab
            rewrites={result.rewrites}
            roleContext={result.roleContext}
            voice={result.voice}
            edits={rewriteEdits}
            rejected={rewritesRejected}
            onChange={onRewriteChange}
          />
        )}
        {active.id === "keywords" && (
          <KeywordsTab
            keywords={result.keywords}
            demoted={keywordsDemoted}
            choices={keywordChoices}
            onChoose={onKeywordChoose}
          />
        )}
        {active.id === "export" && (
          <ExportTab
            cv={cv}
            cvSource={cvSource}
            result={result}
            edits={rewriteEdits}
            keywordChoices={keywordChoices}
            letter={letter}
            letterBusy={letterBusy}
            letterError={letterError}
            onGenerateLetter={onGenerateLetter}
            onLetterChange={onLetterChange}
          />
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-gray-500">
        {usage && (
          <p>
            Tokens used this run: {usage.input.toLocaleString("en-GB")} in, {usage.output.toLocaleString("en-GB")} out
            {usage.cacheRead > 0 ? ` (${usage.cacheRead.toLocaleString("en-GB")} read from cache)` : ""}
          </p>
        )}
        {droppedStrengths > 0 && (
          <p>
            {droppedStrengths} suggested {droppedStrengths === 1 ? "strength was" : "strengths were"} removed because
            your CV could not back them up (no matching quote, a skill or number that isn&apos;t in your CV).
          </p>
        )}
      </div>
    </section>
  );
}
