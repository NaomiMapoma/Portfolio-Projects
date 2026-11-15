import type { Scores } from "@/lib/types";

const ROWS = [
  { key: "roleMatch", label: "Role match", weight: "40%" },
  { key: "impact", label: "Impact and quantification", weight: "25%" },
  { key: "keywords", label: "ATS keyword coverage", weight: "20%" },
  { key: "clarity", label: "Clarity and structure", weight: "15%" },
] as const;

/** Plain-English summary written in code from the scores, so it needs no extra API call. */
function summarise(scores: Scores): string {
  const overall = scores.overall ?? 0;
  const ranked = [...ROWS].sort((a, b) => scores[b.key].score - scores[a.key].score);
  const best = ranked[0].label.toLowerCase();
  const weakest = ranked[ranked.length - 1].label.toLowerCase();

  const band =
    overall >= 75
      ? "Your CV is a strong match for this role."
      : overall >= 55
        ? "Your CV is a reasonable match for this role, with clear room to improve."
        : "Your CV is a weak match for this role as it stands.";

  return `${band} Your strongest area is ${best}. The area with most room to improve is ${weakest}. This score is a guide to how well the CV matches the role, not a prediction of any real ATS result.`;
}

export default function ScoreTab({ scores }: { scores: Scores }) {
  const overall = scores.overall ?? 0;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-semibold text-accent" aria-label={`Overall score ${overall} out of 100`}>
          {overall}
        </span>
        <span className="text-xl text-gray-500">/ 100</span>
      </div>
      <p className="mt-4 max-w-2xl text-gray-700">{summarise(scores)}</p>

      <ul className="mt-8 space-y-6">
        {ROWS.map(({ key, label, weight }) => {
          const { score, reason } = scores[key];
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">
                  {label} <span className="text-sm font-normal text-gray-500">(weight {weight})</span>
                </span>
                <span className="font-medium">{score}</span>
              </div>
              <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
                className="mt-2 h-3 w-full rounded-full bg-gray-200"
              >
                <div className="h-3 rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
              </div>
              <p className="mt-2 text-sm text-gray-600">{reason}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
