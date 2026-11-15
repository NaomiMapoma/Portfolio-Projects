# 🚀 FastTrack: Honest CV Tailoring

## 📚 Overview

FastTrack is a local-only web app that compares a real CV with a job description and shows how to reword **your own experience** to fit the role. It gives a match score, evidence-backed strengths and gaps, rewritten bullets, a rewritten personal summary, ATS keywords and an optional cover letter.

The goal is a CV tool that is **honest by design**: it never invents experience, skills or numbers. Every suggestion cites a source bullet and an exact quote from the CV, and code checks every quote, number and keyword before anything is shown. It runs on your own machine, and your CV is only sent to the Claude API to produce the result.

---

## 🎯 Project Objectives

Built from a product requirements document ([`docs/PRD.md`](docs/PRD.md)):

- Compare a **CV** (PDF, Word or pasted text) with a **job description** (text or URL)
- Give a **match score** with a reason for each part
- Show **strengths and gaps**, each backed by a quote from the CV
- Suggest **bullet and summary rewrites** (light touch and role-tailored) with `[placeholders]` where a real number is needed
- Sort **ATS keywords** into what you have, what you can truthfully add, and genuine gaps
- **Export the tailored CV** in the original format, plus an optional **cover letter** in your own voice
- Keep it **basic, private and cheap**: no database, no stored data, capped tokens

---

## 🛠️ MVP Tech Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for the basic UI
- **Anthropic Claude API** (`claude-sonnet-5-5`, set by environment variables) for analysis, rewrites, fact-checking and the cover letter
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
- Every AI suggestion cites a **source bullet ID and exact quote**.
- No number appears in a rewrite unless it is in the original or is a `[placeholder]`.
- A second fact-check pass flags unsupported wording amber instead of hiding it.
- `npm run audit:privacy` scans the code and the built browser bundle for storage, logging and key leaks.

Anthropic's own retention policy applies on its side. Read it before using a real CV (see PRD section 11).

---

## 💡 Key Findings

- **Fact-check model:** in testing it caught **5 of 5** planted unsupported rewrites and **2 of 2** unsupported keywords, with **0** good rewrites wrongly flagged. A smaller model over-flagged real output, so the default is Sonnet.
- **Cost:** a full 22-call live test run uses roughly 20k input and 26k output tokens, a few pence in total.
- **Plain by design:** strict "facts only" rules make output plainer than a human would write. The app flags machine-sounding wording and lets you paste a writing sample so the cover letter sounds more like you.
- **Cross-industry tailoring:** sector-specific wording (for example FCA language) is restated neutrally when the job is in a different industry, without claiming experience in the new sector.

---

## 📄 Documents

| file | description |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | product requirements: problem, principles, features, truthfulness guardrails, tech stack, privacy |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | the step-by-step Claude Code prompt pack used to build the app, one feature at a time |
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

**How to use it:** add your CV and a job description, click **Analyse**, read the tabs, accept the rewrites you want (typing your real numbers over any `[placeholder]`), then export your CV from the **Export** tab. The cover letter is optional and only written when you click.

**Checks:**

```bash
npm run check        # lint, type-check, offline tests, build and privacy audit
npm run test:live    # calls the real API, costs a few pence
```

---

## ⚠️ Known Limits

- Scanned PDFs cannot be read, so paste the text instead.
- Job links behind a login (LinkedIn and similar) usually cannot be read, so paste the job description.
- PDF export is a close match, not identical. Upload a Word file for an exact match.
- The green and amber tags are a strong guide, not a guarantee. Read every rewrite against your CV before sending it.
- The score is a guide to how well your CV matches the role. It does not predict any real ATS result.
