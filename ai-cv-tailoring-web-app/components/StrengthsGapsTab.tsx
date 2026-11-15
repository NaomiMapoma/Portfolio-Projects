import type { AnalysisCore } from "@/lib/types";
import EmphasiseQuantify from "./EmphasiseQuantify";

const SEVERITY_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

export default function StrengthsGapsTab({ result }: { result: AnalysisCore }) {
  const { strengths, gaps } = result;

  return (
    <div className="space-y-10">
      <section aria-labelledby="strengths-heading">
        <h3 id="strengths-heading" className="text-lg font-semibold">
          What&apos;s working well
        </h3>
        {strengths.length === 0 ? (
          <p className="mt-3 text-gray-600">
            No strengths could be backed up with a quote from your CV, so none are shown.
          </p>
        ) : (
          <ul className="mt-4 space-y-5">
            {strengths.map((s, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-gray-700">{s.whyItMatters}</p>
                <blockquote className="mt-3 border-l-4 border-accent pl-3 text-sm text-gray-700">
                  &ldquo;{s.evidenceQuote}&rdquo;
                  <span className="ml-2 text-xs text-gray-500">from your CV, {s.sourceBulletId}</span>
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="gaps-heading">
        <h3 id="gaps-heading" className="text-lg font-semibold">
          Gaps and weak spots
        </h3>
        {gaps.length === 0 ? (
          <p className="mt-3 text-gray-600">No gaps were reported.</p>
        ) : (
          <ul className="mt-4 space-y-5">
            {gaps.map((g, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium">{g.requirement}</p>
                  <span
                    className={
                      g.severity === "high"
                        ? "rounded-full border border-accent px-2 py-0.5 text-xs font-medium text-accent"
                        : "rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600"
                    }
                  >
                    {SEVERITY_LABEL[g.severity]} severity
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <span className="font-medium">What your CV shows: </span>
                  {g.whatCvShows}
                </p>
                {g.evidenceQuote && (
                  <blockquote className="mt-2 border-l-4 border-gray-300 pl-3 text-sm text-gray-700">
                    &ldquo;{g.evidenceQuote}&rdquo;
                    <span className="ml-2 text-xs text-gray-500">from your CV, {g.sourceBulletId}</span>
                  </blockquote>
                )}
                <p className="mt-3 text-sm">
                  <span className="font-medium">How to handle it: </span>
                  {g.howToHandle}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EmphasiseQuantify achievements={result.achievements} />
    </div>
  );
}
