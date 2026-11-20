import type { Assessment, EvidenceItem, PlanAction, RequirementStatus } from "@/lib/assess-types";
import { NOTES_SOURCE } from "@/lib/assess-source";

/** "Public sector" mid-sentence reads oddly, so lower-case a plain capital but leave names and acronyms (NHS, Jira) alone. */
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

// The assessment as one readable page: score, what works, gaps, requirements, and the plan. Pure display.

function evidenceLine(item: Pick<EvidenceItem, "sourceBulletId" | "evidenceQuote">): string | null {
  if (!item.evidenceQuote) return null;
  // Bullet IDs are for the app's own checks, not for the reader.
  const from = item.sourceBulletId === NOTES_SOURCE ? "your notes" : "your CV";
  return `From ${from}: “${item.evidenceQuote}”`;
}

function Points({ items, empty }: { items: EvidenceItem[]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="mt-3 list-disc space-y-3 pl-5">
      {items.map((item, i) => {
        const ev = evidenceLine(item);
        return (
          <li key={`${item.label}-${i}`} className="text-base leading-relaxed">
            <span className="font-medium">{item.label}.</span> {item.text}
            {ev && <span className="mt-0.5 block text-sm text-gray-600">{ev}</span>}
          </li>
        );
      })}
    </ul>
  );
}

const STATUS: Record<RequirementStatus, { word: string; icon: string; cls: string }> = {
  yes: { word: "Yes", icon: "✓", cls: "bg-green-100 text-green-900" },
  partial: { word: "Partial", icon: "!", cls: "bg-amber-100 text-amber-900" },
  no: { word: "No", icon: "✕", cls: "bg-red-100 text-red-900" },
};

const ACTION: Record<PlanAction, string> = { reword: "Reword", reorder: "Reorder", shorten: "Shorten", cut: "Cut" };

export default function AssessmentView({ assessment: a }: { assessment: Assessment }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="as-score">
        <h3 id="as-score" className="text-lg font-semibold">
          Fit assessment
        </h3>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-semibold">{a.score}</span>
          <span className="text-gray-600">out of 100</span>
        </p>
        <div
          role="progressbar"
          aria-label="Fit score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={a.score}
          aria-valuetext={`${a.score} out of 100`}
          className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
        >
          <div className="h-full bg-accent" style={{ width: `${a.score}%` }} />
        </div>
        {a.scoreReason && <p className="mt-2 text-sm text-gray-700">{a.scoreReason}</p>}
        {a.roleContext && (
          <p className="mt-1 text-sm text-gray-600">
            I read this role as {lowerFirst(a.roleContext.industry)}, {lowerFirst(a.roleContext.seniority)}
            {a.roleContext.priorities.length > 0 && <>, caring most about: {a.roleContext.priorities.join("; ")}</>}.
          </p>
        )}
      </section>

      <section aria-labelledby="as-strengths">
        <h3 id="as-strengths" className="text-lg font-semibold">
          Working well
        </h3>
        <Points items={a.strengths} empty="No strengths could be backed up with a quote from your CV." />
      </section>

      <section aria-labelledby="as-gaps">
        <h3 id="as-gaps" className="text-lg font-semibold">
          Gaps
        </h3>
        <Points items={a.gaps} empty="No clear gaps were found." />
      </section>

      <section aria-labelledby="as-req">
        <h3 id="as-req" className="text-lg font-semibold">
          Keywords and requirements
        </h3>
        {a.requirements.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No requirements could be read from the job description.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-base">
            <caption className="sr-only">Requirements from the job description and whether your CV shows each one</caption>
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-600">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Requirement
                </th>
                <th scope="col" className="py-2 font-medium">
                  On your CV?
                </th>
              </tr>
            </thead>
            <tbody>
              {a.requirements.map((r, i) => {
                const s = STATUS[r.status];
                return (
                  <tr key={`${r.requirement}-${i}`} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3">{r.requirement}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium ${s.cls}`}>
                        <span aria-hidden="true">{s.icon}</span>
                        {s.word}
                      </span>
                      {r.note && <span className="ml-2 text-sm text-gray-600">{r.note}</span>}
                      {evidenceLine(r) && <span className="mt-0.5 block text-sm text-gray-600">{evidenceLine(r)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="as-plan">
        <h3 id="as-plan" className="text-lg font-semibold">
          How I&apos;d tailor your CV
        </h3>
        {a.plan.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No changes are suggested.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {a.plan.map((p, i) => (
              <li key={`${p.label}-${i}`} className="text-base leading-relaxed">
                <span className="mr-2 inline-block rounded border border-gray-600 px-1.5 text-sm font-medium text-gray-800">{ACTION[p.action]}</span>
                <span className="font-medium">{p.label}.</span> {p.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
