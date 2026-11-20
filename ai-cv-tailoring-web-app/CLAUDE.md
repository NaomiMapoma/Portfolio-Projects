# FastTrack: rules for all future work

`docs/PRD.md` is the source of truth. Read it before building anything.

## Rules

a. **No fabrication.** The app must never fabricate or exaggerate CV content.
b. **Cite sources.** Every AI suggestion must cite a source: a CV bullet ID with an exact quote from the CV, or one of the user's typed answers ("Answer 2"), or the user's notes (with a quote from them).
c. **No invented numbers.** Never put a number in a draft line unless it is in the original line, the user's answers or the user's notes. There are no placeholders: a figure the user does not give is left out.
d. **Basic UI.** Keep the UI basic and clear, and meet WCAG 2.2 AA (PRD section 5): one heading scale (h1 30px, h2 24px, h3 18px), body text 16px and never below 14px, text and form borders with enough contrast, a visible focus ring, labelled controls, targets of at least 40px, status never shown by colour alone, and no sideways scrolling at 320px wide.
e. **One step at a time.** Build only the step the user asks for.
f. **Privacy.** CV, job description, notes and answer text may only be sent to the Claude API, from server-side code, for the assessment, the draft and the cover letter. Never write it to disk, a database, logs, cookies or localStorage. Never send it to any other service. Never log request or response bodies.
g. **UK English.** All AI-written text must be in UK English (organised, optimise, programme).
h. **Token efficiency (PRD section 9).** Read model names from environment variables (`ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`), never hard-code them. Use two main calls (the assessment, then the draft) plus one batched fact-check call per draft. The fact-check stays a separate call, never merged into the draft call. Cap the draft and the outputs. Never regenerate results when the user moves between steps; the draft runs only after the user clicks Draft my CV, and a rework only when they click Rework.
i. **Human-sounding writing.** All AI-written text must follow the shared style guide in `lib/style.ts` (plain words, the candidate's own verbs, no machine-sounding phrases or em dashes). Style never overrides rules a to c: tone can change, facts cannot.

## Layout

`app/` (pages and `app/api/` routes), `components/`, `lib/`, `scripts/`, `docs/`.

## Note

The Next.js version here may differ from what you know. See `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js code.
