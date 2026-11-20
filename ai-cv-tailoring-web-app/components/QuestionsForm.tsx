import type { Question } from "@/lib/assess-types";

type Props = {
  questions: Question[];
  answers: Record<string, string>;
  skipped: Record<string, boolean>;
  onAnswer: (id: string, value: string) => void;
  onSkip: (id: string, skipped: boolean) => void;
  onDraft: () => void;
  drafting?: boolean;
  /** True when a draft already exists, so drafting again replaces it. */
  hasDraft?: boolean;
};

// A short form: one text box per question, each skippable. Answers live in the page's memory only.
export default function QuestionsForm({ questions, answers, skipped, onAnswer, onSkip, onDraft, drafting = false, hasDraft = false }: Props) {
  if (questions.length === 0) {
    return (
      <section aria-labelledby="q-heading">
        <h3 id="q-heading" className="text-lg font-semibold">
          Questions before I draft anything
        </h3>
        <p className="mt-2 text-sm text-gray-600">I have no questions. Your CV is clear enough to draft from.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="q-heading">
      <h3 id="q-heading" className="text-lg font-semibold">
        Questions before I draft anything
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Your answers count as evidence, like your CV, so only write what is true. Skip any you can&apos;t answer and I&apos;ll
        leave that part out.
      </p>
      <ul className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const isSkipped = !!skipped[q.id];
          return (
            <li key={q.id} className="rounded-lg border border-gray-200 p-4">
              <label htmlFor={`q-${q.id}`} className="block text-base font-medium">
                {i + 1}. {q.text}
              </label>
              {q.ifSkipped && <p className="mt-1 text-sm text-gray-600">If you skip this: {q.ifSkipped}</p>}
              <textarea
                id={`q-${q.id}`}
                value={answers[q.id] ?? ""}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                disabled={isSkipped}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-500 p-3 text-base disabled:bg-gray-50 disabled:text-gray-600"
              />
              <label className="mt-1 flex min-h-11 items-center gap-3 text-base text-gray-700">
                <input
                  type="checkbox"
                  checked={isSkipped}
                  onChange={(e) => onSkip(q.id, e.target.checked)}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                Skip this one
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDraft}
          disabled={drafting}
          className="min-h-11 rounded-lg bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {drafting ? "Drafting…" : hasDraft ? "Draft again" : "Draft my CV"}
        </button>
        <p className="text-sm text-gray-600">Uses only your CV, your notes and these answers.{hasDraft && " Drafting again replaces your current draft."}</p>
      </div>
    </section>
  );
}
