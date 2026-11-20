# FastTrack: notes for coding agents

Read `CLAUDE.md` (the rules) and `docs/PRD.md` (the source of truth, version 0.6) before changing anything. `docs/PROMPTS.md` is the build history, one prompt per step.

## Commands

- `npm run dev` runs the app at http://localhost:3000.
- `npm run check` runs lint, type-check, all offline tests, the build and the privacy audit. Run it before saying work is done.
- `npm test` runs the offline tests and audits only (no API calls, no cost).
- `npm run test:live` runs the guided flow against the real Claude API on a fictional CV (assessment, then draft with its fact-check; about 12,000 tokens, a few pence). Run it after any prompt change and read every FAIL.

## Layout

`app/` pages and API routes (`assess`, `draft`, `cover-letter`, `parse-cv`, `fetch-jd`, `health`), `components/` the UI (`DraftView.tsx` holds the draft step and the whole-CV view, `ReviewPanel.tsx` the one-change-at-a-time review, `wordDiff.ts` the word-level differences), `lib/` the logic (assessment in `assess.ts`, draft in `draft.ts`, the shared client and errors in `claude.ts`, fact-checks in `factcheck.ts` and `letter.ts`, shared checks in `bullets.ts`, `numbers.ts` and `keywords.ts`, skills-line changes in `skills-line.ts`, reordering in `draft-moves.ts` and `draft-apply.ts`, export in `export*.ts`, cover letter in `letter.ts`, style in `style.ts` and `style-checks.ts`), `scripts/` tests, audits and a live check.

## Rules that are easy to break

- **Honesty first.** Never fabricate or exaggerate CV content. Every suggestion cites a CV bullet ID with an exact quote, or one of the user's answers or notes. No number in a draft line unless it is in the original line, the answers or the notes (no placeholders). Tailoring is by emphasis and wording, never by adding facts, a sector or scope words from the job description. The summary may not gain any new name or number (it may use facts from the answers and notes); skills lines are never rewritten by the model. Answers and notes must be worked into the right sentence, never tacked on.
- **Privacy.** CV, job description, notes, answers and the optional writing sample go only to the Claude API, from server-side code. Never write them to disk, a database, logs, cookies or browser storage, and never log request or response bodies. `npm run audit:privacy` must stay clean.
- **Secrets.** Never print, log or commit `.env.local` or the API key. Use fictional text for any test, demo or screenshot, never a real CV.
- **UK English** in all AI-written text.
- **Models** come from `ANTHROPIC_MODEL` and `ANTHROPIC_FAST_MODEL`. Never hard-code a model name.
- **Tokens.** Two main calls (assessment, then draft) plus one batched fact-check call per draft, kept separate from the draft call. The cover letter and any rework only on click. No retries beyond the one schema retry, and no regenerating results when the user moves between steps.
- **Model-facing schemas must stay small.** The API rejects a schema whose compiled grammar is too large. Add new assessment and draft fields as flat, required strings (with defaults), not nested or optional objects, and turn them into structured data in code.
- **UI rules.** The draft and inputs screens keep fixed-height areas so boxes never shift, notes sit beside the lines they explain, and a change that only differs by apostrophe or quote style is never shown. Check a layout change at 320px wide and with a temporary mock page that you delete afterwards.
- **Real CVs.** Never read files outside the project (such as a CV folder) unless the user has given you that file or folder in the conversation.
- **Do not weaken a check to make it pass.** Decide whether a failure is a real bug, model behaviour or a mistake in the check, and say which.
- **One step at a time.** Build only what was asked.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
