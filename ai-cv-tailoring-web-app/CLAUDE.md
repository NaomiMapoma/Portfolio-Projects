# FastTrack: rules for all future work

`docs/PRD.md` is the source of truth. Read it before building anything.

## Rules

a. **No fabrication.** The app must never fabricate or exaggerate CV content.
b. **Cite sources.** Every AI suggestion must cite a source bullet ID and an exact quote from the CV.
c. **No invented numbers.** Never put a number in a rewrite unless it is in the original or is a [placeholder].
d. **Basic UI.** Keep the UI basic and clear.
e. **One step at a time.** Build only the step the user asks for.
f. **Privacy.** CV and job description text may only be sent to the Claude API, from server-side code, for analysis, rewrites and the cover letter. Never write it to disk, a database, logs, cookies or localStorage. Never send it to any other service. Never log request or response bodies.
g. **UK English.** All AI-written text must be in UK English (organised, optimise, programme).
h. **Token efficiency (PRD section 9).** Read model names from environment variables (`ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`), never hard-code them. Use one main analysis call and one batched fact-check call. Cap rewrites and outputs. Never regenerate results when the user switches tabs.
i. **Human-sounding writing.** All AI-written text must follow the shared style guide in `lib/style.ts` (plain words, the candidate's own verbs, no machine-sounding phrases or em dashes). Style never overrides rules a to c: tone can change, facts cannot.

## Layout

`app/` (pages and `app/api/` routes), `components/`, `lib/`, `scripts/`, `docs/`.

## Note

The Next.js version here may differ from what you know. See `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js code.
