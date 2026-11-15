import type { Keywords } from "@/lib/types";

type Props = {
  keywords: Keywords;
  demoted: number;
  choices: Record<string, boolean>;
  onChoose: (keyword: string, chosen: boolean) => void;
};

export default function KeywordsTab({ keywords, demoted, choices, onChoose }: Props) {
  const { present, addTruthfully, gaps } = keywords;

  return (
    <div className="space-y-10">
      <p className="text-gray-700">
        These are the most important terms in the job description, sorted by what your CV actually shows. ATS software
        often matches exact wording, so use a term only where it is true.
      </p>

      <section aria-labelledby="kw-present">
        <h3 id="kw-present" className="text-lg font-semibold">
          Already in your CV
        </h3>
        {present.length === 0 ? (
          <p className="mt-3 text-gray-600">None of the key terms were found word for word in your CV.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {present.map((k) => (
              <li key={k} className="rounded-full border border-gray-300 px-3 py-1 text-sm">
                {k}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="kw-add">
        <h3 id="kw-add" className="text-lg font-semibold">
          You can add these truthfully
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Your CV already shows this experience in different words. Each one is backed by a quote from your CV.
        </p>
        {addTruthfully.length === 0 ? (
          <p className="mt-3 text-gray-600">No terms could be backed up with a quote from your CV.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {addTruthfully.map((a) => (
              <li key={a.keyword} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium">{a.keyword}</p>
                <blockquote className="mt-2 border-l-4 border-accent pl-3 text-sm text-gray-700">
                  &ldquo;{a.evidenceQuote}&rdquo;
                  <span className="ml-2 text-xs text-gray-500">from your CV, {a.sourceBulletId}</span>
                </blockquote>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Best place for it: </span>
                  {a.suggestedSection}
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!choices[a.keyword]}
                    onChange={(e) => onChoose(a.keyword, e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Plan to add this (shown as a reminder in Export)
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {keywords.skillsToFront && keywords.skillsToFront.length > 0 && (
        <section aria-labelledby="kw-front" className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 id="kw-front" className="text-lg font-semibold">
            Skills to move to the front
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            These are already in your skills section and matter most for this role. Consider listing them first.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {keywords.skillsToFront.map((k) => (
              <li key={k} className="rounded-full border border-gray-300 px-3 py-1 text-sm">
                {k}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="kw-gaps"
        className="rounded-lg border-2 border-accent bg-gray-50 p-5"
      >
        <h3 id="kw-gaps" className="text-lg font-semibold">
          Genuine gaps
        </h3>
        <p role="note" className="mt-2 text-sm font-medium text-accent">
          Warning: only add these if they are genuinely true for you. Don&apos;t add a term just to match the job
          description. They are never put into your rewrites.
        </p>
        {gaps.length === 0 ? (
          <p className="mt-3 text-gray-600">No gaps were found among the key terms.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {gaps.map((k) => (
              <li key={k} className="rounded-full border border-gray-400 bg-white px-3 py-1 text-sm">
                {k}
              </li>
            ))}
          </ul>
        )}
      </section>

      {demoted > 0 && (
        <p className="text-xs text-gray-500">
          {demoted} {demoted === 1 ? "term was" : "terms were"} moved to gaps because no matching text or supporting
          quote could be found in your CV.
        </p>
      )}
    </div>
  );
}
