# FastTrack: notes for coding agents

Read `CLAUDE.md` (the rules) and `docs/PRD.md` (the source of truth, version 0.3) before changing anything. `docs/PROMPTS.md` is the build history, one prompt per step.

## Commands

- `npm run dev` runs the app at http://localhost:3000.
- `npm run check` runs lint, type-check, all offline tests, the build and the privacy audit. Run it before saying work is done.
- `npm test` runs the offline tests and audits only (no API calls, no cost).
- `npm run test:live` calls the real Claude API (about 22 calls, a few pence). Run it after any prompt change and read every FAIL.

## Layout

`app/` pages and API routes, `components/` the UI, `lib/` the logic (analysis in `claude.ts`, rewrites in `rewrites.ts`, keywords in `keywords.ts`, fact-check in `factcheck.ts`, cover letter in `letter.ts`, style in `style.ts` and `style-checks.ts`), `scripts/` tests, audits and fictional fixtures.

## Rules that are easy to break

- **Honesty first.** Never fabricate or exaggerate CV content. Every suggestion cites a bullet ID and an exact quote. No number in a rewrite unless it is in the original or a `[placeholder]`. Tailoring is by emphasis and wording, never by adding facts, a sector or scope words from the job description. The summary may not gain any new name; skills lines are never rewritten.
- **Privacy.** CV, job description and the optional writing sample go only to the Claude API, from server-side code. Never write them to disk, a database, logs, cookies or browser storage, and never log request or response bodies. `npm run audit:privacy` must stay clean.
- **Secrets.** Never print, log or commit `.env.local` or the API key. Use fictional text for any test, demo or screenshot, never a real CV.
- **UK English** in all AI-written text.
- **Models** come from `ANTHROPIC_MODEL` and `ANTHROPIC_FAST_MODEL`. Never hard-code a model name.
- **Tokens.** One analysis call, one batched fact-check call, and the cover letter only on click. No retries beyond the one schema retry, and no regenerating results when tabs switch.
- **Model-facing schemas must stay small.** The API rejects a schema whose compiled grammar is too large. Add new analysis fields as flat, required strings (with defaults), not nested or optional objects, and turn them into structured data in code.
- **Do not weaken a check to make it pass.** Decide whether a failure is a real bug, model behaviour or a mistake in the check, and say which.
- **One step at a time.** Build only what was asked.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
