import type { AnalysisCore } from "@/lib/types";

export default function EmphasiseQuantify({ achievements }: { achievements: AnalysisCore["achievements"] }) {
  const { emphasise, quantify } = achievements;

  return (
    <section aria-labelledby="eq-heading" className="space-y-8">
      <h3 id="eq-heading" className="text-lg font-semibold">
        Emphasise and quantify
      </h3>

      <div>
        <h4 className="font-medium">Achievements to lead with for this role</h4>
        {emphasise.length === 0 ? (
          <p className="mt-2 text-gray-600">No achievements could be backed up with a quote from your CV.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {emphasise.map((e, i) => (
              <li key={`${e.sourceBulletId}-${i}`} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium">
                  {i + 1}. {e.title}
                </p>
                <p className="mt-1 text-sm text-gray-700">{e.reason}</p>
                <blockquote className="mt-2 border-l-4 border-accent pl-3 text-sm text-gray-700">
                  &ldquo;{e.evidenceQuote}&rdquo;
                  <span className="ml-2 text-xs text-gray-500">from your CV, {e.sourceBulletId}</span>
                </blockquote>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h4 className="font-medium">Bullets that would be stronger with a real number</h4>
        <p className="mt-1 text-sm text-gray-600">
          Look for the real figure. Don&apos;t estimate one you can&apos;t back up.
        </p>
        {quantify.length === 0 ? (
          <p className="mt-2 text-gray-600">Nothing to quantify.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {quantify.map((q) => (
              <li key={q.sourceBulletId} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-800">
                  {q.bullet} <span className="text-xs text-gray-500">({q.sourceBulletId})</span>
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Question for you: </span>
                  {q.metricToLookFor}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
