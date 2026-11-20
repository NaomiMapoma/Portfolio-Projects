# 🚀 FastTrack: Honest CV Tailoring

## 📚 Overview

FastTrack is a local-only web app that tailors your real CV to a job description, honestly. You add your CV and the job, read one assessment, answer a few clarifying questions, then see a drafted CV that you can rework with one instruction or download in your original layout. An optional cover letter uses only facts you have given it.

It follows one guided path:

1. **Inputs:** upload your CV (PDF or Word) or paste it, paste the job description or give its web address, and optionally add notes about anything not on your CV.
2. **Assessment:** a fit score out of 100, what is working well and the gaps (each backed by a quote from your CV), a Yes, Partial or No table of the job's requirements, and a plain plan for how your CV would be tailored (reword, reorder, shorten or cut), applied in the draft where it is safe.
3. **Questions:** three to five short questions about requirements or figures your CV does not clearly show. Each says what happens if you skip it.
4. **Draft:** review the changes one at a time (original and new wording side by side, with the differences marked, problems first) or on the whole CV with each note beside the line it explains. Each change shows its source (your CV, one of your answers or your notes). You can put any line back to your original, keep all the safe changes at once, ask for a rework, or download.

The goal is a CV tool that is **honest by design**: it never invents experience, skills or numbers. Code checks every quote, figure and tool, a separate fact-check call verifies every new line, and your answers and notes count as evidence only because they are your own statements. It runs on your own machine, and your text is only sent to the Claude API.

---

## 🎯 Project Objectives

Built from a product requirements document ([`docs/PRD.md`](docs/PRD.md), version 0.6):

- Compare a **CV** (PDF, Word or pasted text) with a **job description** (text or URL)
- Give one **fit score** with a reason, **strengths and gaps** with evidence, and a **requirements table**
- Ask **clarifying questions** before drafting, so nothing is guessed
- Draft a **tailored CV** (reworded, shortened, cut or reordered lines, with your answers worked into the right sentence) with no placeholders and no invented numbers
- **Download in the original format**: a Word file is edited in place, a PDF is rebuilt to match, pasted text uses a plain layout
- Offer an optional **cover letter** in your own voice
- Keep it **basic, private, accessible and cheap**: no database, no stored data, capped tokens, WCAG 2.2 AA

---

## 🛠️ MVP Tech Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for the basic UI
- **Anthropic Claude API** (`claude-sonnet-5-5`, set by environment variables) for the assessment, the draft, fact-checking and the cover letter
- **Zod** to validate every model response
- **mammoth** and **unpdf** to read Word and PDF CVs
- **docx** and **JSZip** to edit and export Word files in place
- **jsdom** and **@mozilla/readability** to read job description pages
- **tsx** scripts for offline tests, honesty audits and live API checks
- No database, no analytics, no third-party services

---

## 🔒 Privacy and Honesty Guardrails

- CV and job text go **only** to the Claude API, from server-side code. Nothing is written to disk, a database, logs, cookies or browser storage.
- Your API key lives in `.env.local` (git-ignored) and never reaches the browser.
- Every AI suggestion cites a source: a CV line with an exact quote, one of your answers, or your notes.
- No number appears in the draft unless it is in the original line, your answers or your notes. There are no placeholders.
- A separate fact-check call flags unsupported wording amber instead of hiding it, and your answers and notes count as evidence.
- `npm run audit:privacy` scans the code and the built browser bundle for storage, logging and key leaks.

Anthropic's own retention policy applies on its side. Read it before using a real CV (see PRD section 11).

---

## 💡 Key Findings

- **Fact-check model:** in earlier testing it caught **5 of 5** planted unsupported rewrites, with **0** good rewrites wrongly flagged. A smaller model over-flagged real output, so the default is Sonnet.
- **Cost:** a first draft is three calls (assessment, draft, fact-check) and uses roughly 6k to 10k tokens on a short CV, a few pence (more on a long one). Each rework repeats the draft and the fact-check. The cover letter is two more calls, only when you click.
- **Plain by design:** strict "facts only" rules make output plainer than a human would write. The app flags machine-sounding wording and lets you paste a writing sample so the cover letter sounds more like you.
- **Questions beat placeholders:** instead of inserting `[X%]` for you to fill in, the app asks first and leaves out anything you do not answer.
- **Cross-industry tailoring:** sector-specific wording (for example FCA language) is dropped or restated neutrally when the job is in a different industry, and kept and led with for a bank or other regulated finance job, without ever claiming experience in a new sector.
- **Review, not just read:** a one-change-at-a-time review mode with word-level differences, problems first and a keep-all-safe shortcut makes a long draft quick to check.

---

## 📄 Documents

| file | description |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | product requirements: problem, principles, features, truthfulness guardrails, tech stack, privacy |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | the original step-by-step prompt pack (the app has since moved to the guided flow described in the PRD) |
| [`CLAUDE.md`](CLAUDE.md) | rules Claude Code follows in this repo (no fabrication, cite sources, privacy, UK English, token limits) |
| [`AGENTS.md`](AGENTS.md) | notes for coding agents: commands, layout and the rules that are easy to break |
| [`.env.local.example`](.env.local.example) | environment variable template (no real key) |
| [`scripts/`](scripts) | offline tests, privacy and UK-English audits, and live honesty checks |

---

## 🏃 Getting Started

You need Node.js 20 or later and an Anthropic API key with credit.

```bash
npm install
cp -n .env.local.example .env.local   # then add your own ANTHROPIC_API_KEY (-n never overwrites an existing file)
npm run dev                        # open http://localhost:3000
```

`.env.local` is ignored by git, so your key is never committed. Models are set there too:

```
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_FAST_MODEL=claude-sonnet-5-5
```

**How to use it:** add your CV and a job description (and notes if you like), click **Assess my CV**, read the assessment, answer the questions you can (skip the rest), click **Draft my CV**, then use **Use my original** on any line you do not want, **Rework the draft** with an instruction if you want changes, and **Download**. The cover letter is optional and only written when you click.

**Checks:**

```bash
npm run check        # lint, type-check, offline tests, build and privacy audit
npm run test:live    # runs the guided flow against the real API on a fictional CV, costs a few pence
```

---

## ⚠️ Known Limits

- **You can't type over a line.** For each changed line you can use your original, or ask for a rework with one instruction. There is no hand-editing box yet.
- **Word files work best.** A PDF's text cannot be split into roles reliably, so reordering is refused for PDF uploads. In a Word file, a heading joined to the next line with Shift+Enter is read as one line, so press Enter after it. A line break inside a paragraph is read as a space.
- **Reordering is limited to bullets inside one role.** It works from the role lines that carry dates, and only when the model's order is an exact reordering of that role's bullets. Otherwise nothing is moved and the app says so. Check the order on your own CV.
- **The on-screen CV is a plain view.** Your real fonts and layout are kept in the file you download (a Word upload is edited in place, a PDF is rebuilt to match as closely as possible, and pasted text uses a plain layout).
- **One CV at a time.** There is no comparison of several CV versions and no interview-prep notes for the gaps (both are listed as later ideas in the PRD).
- **Code can only catch a claim that uses a requirement's own distinctive word.** A claim phrased very differently is left to the fact-check call, so read every amber line and every changed line.
- Scanned PDFs cannot be read, so paste the text instead.
- Job links behind a login (LinkedIn and similar) usually cannot be read, so paste the job description.
- The score is a guide to how well your CV matches the role. It does not predict any real ATS result.
- The app was built and tested with fictional CVs. Check your first real run carefully against your own CV before you send anything.
- Accessibility was checked with in-page checks (contrast, text sizes, labels, focus ring, reflow at 320px), not with an automated scanner, a full keyboard walkthrough or a screen reader.
