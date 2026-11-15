# FastTrack: Product Requirements Document

Owner: Naomi · Version 0.3 (MVP plus later improvements) · 15 Nov 2026 · Local-only web app

This file is the source of truth for the build. Save it in the project as `docs/PRD.md`. The build prompts are in `PROMPTS.md`.

**Changes since 0.2 (added after the MVP, 13 Nov 2026):** the personal summary is now rewritten (F12); every rewrite is tailored to the role and industry, with a visible 'how I read this role' panel (F13); skills sections are never rewritten but get a 'skills to move to the front' list (F14); a shared style guide, style checks and a voice read from the CV make the writing sound like the user (F15); and an optional writing sample shapes the cover letter's tone (F16). Keyword matching also accepts a different word ending for plain words ('train' and 'Trained'). Sections 2, 4, 5, 7, 8, 9, 10, 11, 12 and 13 are updated to match.

## 1. The core problem

Strong candidates get filtered out because their CV describes duties instead of business impact, and does not use the language of the role. Existing AI CV tools make this worse: they either give generic buzzword rewrites or invent numbers and skills to make the CV match.

**Problem statement:** I need a tool that reads my real CV and a specific job description, tells me honestly how well they match, and shows me how to reword my own experience to land the right impact and keywords, without making anything up and without losing my voice.

## 2. Product principles

- **Truth first.** Every suggestion must be traceable to something already in the CV. No invented employers, tools, metrics, titles or outcomes.
- **Authentic, not generic.** Rewrites keep my facts and my vocabulary, and are tailored to the role without claiming anything new. A 'light touch' option is always offered.
- **Sounds like me.** Written output should not read as machine-made: plain words, my own verbs, no stock phrases. The app flags machine-sounding wording rather than hiding it.
- **Impact over duties.** Suggestions push toward outcome, scale and result, and ask me for the real numbers rather than guessing them.
- **Explain why.** Every score and suggestion has a short reason I can check.
- **Basic and clear.** One page, one accent colour, plain typography. No clutter.
- **Lean on tokens.** Few model calls, short outputs, and the cheapest model that does each job well.

## 3. Goals and non-goals

**MVP goals**
- Upload a CV (PDF, Word or pasted text) and give a job description (URL or pasted text).
- Return a transparent match score with strengths, gaps, rewrites (including the personal summary), achievements to emphasise or quantify, and ATS keywords, all tailored to the role and its industry.
- Export a rewritten CV and a tailored cover letter that use only facts from the original CV.
- Run entirely on my own computer, with low and predictable API usage.

**Non-goals for the MVP**
- User accounts, a database, or saved history
- Hosting or deployment
- Auto-applying to jobs
- Scraping sites behind logins (LinkedIn, etc.). Paste fallback instead.
- Multiple CV design templates

## 4. Key features

- **F1. CV input.** Upload PDF or DOCX, or paste text. Extracted text is shown in an editable box so I can fix parsing errors.
- **F2. Job description input.** Paste text or enter a URL. The fetched text is shown and editable. If a URL cannot be read, I am asked to paste instead.
- **F3. Match score (0 to 100).** Built from four sub-scores: role match, impact and quantification, ATS keyword coverage, and clarity and structure. The overall score is calculated in code from the sub-scores so it is consistent, and each sub-score has a one-line reason.
- **F4. What is working well.** Strengths relevant to this role, each with a quote from my CV as evidence.
- **F5. Gaps and weak spots.** What the role asks for that the CV does not show, with severity and an honest way to handle it (emphasise adjacent real experience, or accept it as a genuine gap).
- **F6. Bullet rewrites.** For the most relevant or weakest bullets (capped, see section 9): the original, a light-touch rewrite, a role-tailored stronger-impact rewrite, what changed and why (naming the role priority it targets), and placeholders like [X%] or [budget] where a real number is needed. The app also lists questions for me, such as 'What was the budget size?'. Light touch is a safe edit that stays close to my wording; stronger impact is restructured around what the role cares about, using only facts in the bullet.
- **F7. Achievements to emphasise or quantify.** A ranked list of achievements to lead with for this role, and a list of bullets that need a metric, with a prompt for which metric to look for.
- **F8. ATS keywords.** Three groups: already in my CV, can be added truthfully (with the evidence and the best section to place them), and genuine gaps (only add if true for me).
- **F9. Truthfulness guardrails (cross-cutting).** See section 7.
- **F10. Export rewritten CV.** I accept or edit each suggestion, then download a DOCX with only accepted changes applied that keeps the original CV's look. A Word upload is edited in place, so its font, sizes, layout and margins are exactly as uploaded (the file stays in the browser tab's memory). A PDF upload is rebuilt as a Word file that matches the detected font, sizes, bold headings and margins as closely as possible (a close match, not identical). Pasted text uses a plain layout. A plain, single-column ATS-friendly version is always available as an option. Chosen keywords are a checklist only and are never inserted automatically.
- **F11. Cover letter helper.** A short tailored letter using only facts from my CV, in my own voice, editable and exportable. Generated only when I ask for it. Quiet style notes show word count, machine-sounding wording and repeated phrases.
- **F12. Personal summary rewrite.** If the CV has a summary, profile or personal statement, its paragraph is always one of the rewrites (listed first, counted within the cap). It is tailored to the role like any other rewrite but is held to a stricter rule: it keeps every number, employer and brand exactly as written and may not introduce any new name. It is shown as 'Personal summary'.
- **F13. Role and industry tailoring.** The analysis first reads the job (industry, seniority, top priorities) and shows this as 'How I read this role' at the top of the Rewrites tab, so a misreading is easy to spot. Rewrites lead with what matches those priorities. When the job is in a different industry from the CV, sector-specific wording (for example FCA financial promotion requirements) may be restated in neutral, still-true terms (for example 'creative approved through a formal compliance review'). The app never claims experience in the target industry and never broadens the scope or strength of a claim. When the sector is the same, sector terms are kept.
- **F14. Skills sections.** Skills lines are lists of tools, so they are never rewritten (code rejects any such rewrite). They are used as evidence, and the Keywords tab lists up to five skills already in the skills section that matter most for the role ('Skills to move to the front'). Each must appear word for word in the CV's skills section and must not be a gap. 'Best place for it' for a keyword to add now names the exact line or section.
- **F15. Voice and style.** The analysis reads how I write from my own CV (person, tense, sentence length, formality, punctuation, and verbs I use, each checked against the CV) and shows it as 'How I read your writing'. Rewrites and the letter try to match it. A shared style guide is part of every prompt, and token-free code checks flag machine-sounding words, em dashes, repeated openers, stock phrases and very long sentences as quiet notes. Style never overrides the truthfulness rules.
- **F16. Writing sample (optional).** Before generating the cover letter I can paste up to 2,000 characters of my own writing (an email, an old letter). It is used only for tone and rhythm, never as a source of facts, is sent only when I click Generate, and is never stored or logged.

## 5. Basic UI

One page with a simple flow and plain styling.
- **Step 1, Inputs:** CV on the left, job description on the right, one 'Analyse' button.
- **Step 2, Results:** tabs for Score, Strengths and Gaps, Rewrites, Keywords, and Export. The Rewrites tab opens with 'How I read this role' and 'How I read your writing'. The Keywords tab includes 'Skills to move to the front'. The cover letter section (in Export) has an optional writing sample box.
- Design: white background, dark grey text, one accent colour, system font, generous spacing, no animations, clear loading and error states.
- Results stay in the browser tab's memory, so switching tabs never triggers another API call.

## 6. Workflow

1. Add CV (upload or paste) and review the extracted text.
2. Add job description (URL or paste) and review the extracted text.
3. Click Analyse. The app splits the CV into numbered bullets and makes one main call to the analysis model, with strict no-fabrication rules. The model first reads the role and my writing style, then writes everything else.
4. The app validates the response against a schema. One batched call to the fast model then fact-checks all rewrites at once.
5. I review the score, strengths, gaps, keywords and achievements.
6. I go through the rewrites, edit them, and fill in the real numbers where placeholders appear.
7. I accept the rewrites I want and export the tailored CV.
8. Optionally, I paste a sample of my own writing, then generate and edit a cover letter and export it.

## 7. Truthfulness guardrails (the most important requirement)

- **Evidence required.** Every strength, rewrite and keyword suggestion must cite a source bullet ID and an exact quote from the CV. No evidence means the item is dropped. This check is done in code, which costs no tokens.
- **No invented numbers.** Rewrites may only use figures that appear in the original CV. Anywhere a number would help, the model must insert a placeholder and ask me for the real value.
- **No invented skills, tools or titles.** Keywords absent from the CV go in the 'genuine gap' group and are never injected into a rewrite.
- **Verification pass.** A second call (fast model, all rewrites in one request) compares each rewrite to the original bullet and the rest of the CV (sent as numbered bullets, so a rewrite can draw on the same role but not borrow from a different one) and flags unsupported claims. A code-level check also rejects any digit in a rewrite that is not in the original bullet or a placeholder.
- **Voice preservation.** Rewrites keep my vocabulary and sentence style where possible. The voice read from my CV only lists verbs that really appear in it. Machine-sounding wording ('leverage', 'spearhead', 'proven track record', em dashes and similar) is discouraged in the prompts and flagged by code, and clichés such as 'results-driven' or 'passionate' are never wanted.
- **Summary guard.** A summary rewrite is rejected in code if it adds a number or a name (employer, brand, regulator, tool) that the original paragraph does not contain. The fact-check applies the same test strictly to the summary.
- **Transferable reframing, not new claims.** Restating sector-specific wording in neutral, still-true terms is allowed for a job in a different industry. Adding a sector, regulator, customer type, outcome, number or scope word borrowed from the job description is not. Tailoring is by emphasis and wording, not by adding detail.
- **Skills lines are never rewritten.** Code rejects any rewrite of a line in a skills section.
- **UK English.** All AI-written text uses UK English.
- **Human in the loop.** Nothing is applied to the exported CV unless I accept it.

## 8. Analysis output (data contract)

The backend asks Claude for structured JSON that is validated with a schema.
- `roleIndustry`, `roleSeniority`, `rolePriorities`, `voiceDescription`, `voiceVerbs`: flat strings returned first, so the model has read the job and my style before writing anything. Code turns them into `roleContext` (industry, seniority, up to 5 priorities) and `voice` (description, up to 8 verbs that must appear in the CV). They are flat because nested or optional fields made the API's compiled output grammar too large.
- `scores`: roleMatch, impact, keywords, clarity (each 0 to 100, with a one-line reason). `overall` is computed in code with weights of 40 / 25 / 20 / 15.
- `strengths[]`: title, why it matters for this role, sourceBulletId, evidenceQuote.
- `gaps[]`: requirement from the job description, severity (high, medium, low), what the CV shows, honest way to handle it.
- `rewrites[]`: sourceBulletId, original, lightTouch, strongerImpact, whatChanged, placeholders[], questionsForMe[], verification status, `kind` ('summary' for the personal summary) and `styleNotes[]` (code-generated, never blocks a rewrite).
- `achievements`: emphasise[] (ranked, with reason) and quantify[] (bullet, suggested metric to look for).
- `keywords`: present[], addTruthfully[] (keyword, evidence, suggested section), gaps[], `skillsToFront[]` (checked in code against the skills section). A plain lowercase single-word keyword counts as present if the CV has it with a different ending ('train' and 'Trained'); names, phrases and anything with capitals or digits stay exact.

## 9. Model choice and token strategy

**Goal:** fast, efficient and strong at structured reasoning, without weakening the analysis.

**Model choice**
- **Main model: Claude Sonnet 5.5** (`claude-sonnet-5-5`). Used for the analysis, rewrites and cover letter. It is quick, handles schema-constrained output and evidence-grounded reasoning well, and costs much less than the larger models.
- **Fact-check model: Claude Sonnet 5.5** (`claude-sonnet-5-5`, set as `ANTHROPIC_FAST_MODEL`). Used only for the fact-check passes, which are narrow comparison tasks. Haiku 5.5 (`claude-haiku-5-5`) was the original choice. In live testing on 12 Nov 2026 it caught all 5 planted unsupported rewrites and 2 of 2 unsupported keywords, the same as Sonnet, but on real output it over-flagged: all 4 cover letters came back amber, against 3 of 4 passing with Sonnet (the fourth was caught by a code check), and it flagged good rewrites and relevance statements. Haiku can still be set in `.env.local` to save a little cost.
- **Not used:** Opus-class is an optional upgrade if rewrite quality is not good enough, at higher cost. Fable and Mythos-class models are excluded because they require 30-day data retention (see section 11).
- Both names are read from `.env.local` (`ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`), so they can be changed without touching code. Check Anthropic's pricing page for current rates.

**Token-saving rules**
1. **One main analysis call.** Score, strengths, gaps, rewrites, achievements and keywords come back in a single structured response, so the CV and job description are sent once, not once per feature.
2. **One batched fact-check call.** All rewrites (and keyword evidence) are verified in one fact-check request, not one request each.
3. **Cap the rewrites.** Only the top 8 to 10 bullets (most relevant to the role, or weakest) get rewrites, and the personal summary counts towards that cap. Stronger-impact rewrites are one sentence.
4. **Trim the inputs.** Strip extra whitespace, page numbers, headers and footers from the CV, and cut boilerplate (benefits, equal opportunity text, company blurb) from the job description where it is easy to detect. Warn me if either input is very long, and enforce a maximum length.
5. **Cap the outputs.** Set `max_tokens` per call, and ask for short fields (for example, reasons under 20 words, 'what changed' under 25 words).
6. **Cache only the static instructions.** The system prompt and schema are identical every run, so they can use prompt caching. The CV and job description go after the cached part, so they are never part of a cache entry.
7. **Keep thinking off by default.** The structured prompt does the reasoning work. Turn extended thinking on only if testing shows quality problems.
8. **Low temperature and one retry.** Retry once on a schema failure only. Never retry in a loop.
9. **On demand only.** The cover letter and the DOCX export run only when I click them, and results are never regenerated when I switch tabs.
10. **Show usage, not content.** Log input and output token counts and timing for each call (never the text), and show a small 'tokens used this run' line, so costs stay visible.

**Expected usage per run:** one Sonnet analysis call (roughly 3,000 to 4,000 output tokens in testing, cap 8,000), one fact-check call, plus an optional Sonnet cover letter call with its own fact-check. A writing sample adds up to about 500 input tokens to the letter call only. Role reading, voice, style checks and skills suggestions add no extra calls.

## 10. MVP tech stack

- **Framework:** Next.js (App Router) with TypeScript. Front end and API routes in one project.
- **Styling:** Tailwind CSS, no component library.
- **AI:** Anthropic Claude API via `@anthropic-ai/sdk`, with structured output as JSON that matches a schema (`output_config.format`). A forced tool call was the first plan, but Sonnet 5.5 does not support forcing a tool, and it also rejects `thinking: disabled` (it does not think before answering, so no thinking setting is sent). API key and model names live only in `.env.local` and are used server-side only.
- **Validation:** `zod` for request and response schemas. Keep the model-facing schema small: the API rejects a schema whose compiled grammar is too large, so new fields are flat, required strings (with defaults) rather than nested or optional objects.
- **Style:** `lib/style.ts` holds the shared style guide and the list of machine-sounding phrases; `lib/style-checks.ts` runs the token-free checks.
- **CV parsing:** `unpdf` for PDF, `mammoth` for DOCX, plain text passthrough.
- **Job URL fetching:** server-side fetch with `@mozilla/readability` and `jsdom`. Only http/https, with localhost and private IPs blocked.
- **Export:** `docx` library for the plain and PDF-matched DOCX files; `jszip` to edit an uploaded Word file in place. All export work happens in the browser, with no API call.
- **Storage:** none. CV and job text are held in memory only for the length of a request and in the open browser tab. Nothing is written to disk, a database, logs, cookies or browser storage.
- **Runs with:** `npm run dev` at localhost:3000.

## 11. Data handling and privacy requirements

The app keeps nothing itself, but it cannot promise what Anthropic does with data after it arrives. Both are set out here so the app never over-promises.

**What the app guarantees (we control this)**
- CV and job text go only to the Claude API, over HTTPS, from server-side code. The API key never reaches the browser.
- The text is used only for analysis, rewrites, keyword advice and the cover letter. No analytics, tracking or other third-party services.
- Nothing is stored: no database, no files, no logging of request or response bodies, no cookies, no browser storage. Closing the tab clears everything.
- API responses are sent with `Cache-Control: no-store` so nothing is cached.
- The optional writing sample is treated exactly like the CV: Claude API only, from server-side code, only when I click Generate cover letter, never stored or logged, and its use is limited to tone (the privacy audit checks that only the cover letter UI, route and letter code handle it).
- The UI states this plainly next to the Analyse button, and the cover letter section says the same before sending.

**What the app cannot guarantee (Anthropic controls this)**
- Anthropic's API documentation says prompts and outputs are not retained by default, while its privacy centre says API inputs and outputs are deleted within 30 days. The two pages word it differently, so check the current policy before relying on either. Content flagged for policy violations can be kept longer.
- A guarantee of no retention needs a zero data retention (ZDR) arrangement, which Anthropic agrees per organisation through its sales team. Code cannot switch it on.
- Anthropic's documentation says its newest top-tier models (Fable and Mythos class) require 30-day retention and are not available under ZDR unless authorised. Sonnet 5.5 and Haiku 5.5 are the chosen models.
- Anthropic's documentation says retained data is never used for model training without express permission.

**Suggested UI wording:** 'Your CV and job description are sent securely to the Claude API only to produce your analysis and rewrites. This app does not store them. Anthropic's own retention policy applies on its side.'

**Before using a real CV:** read Anthropic's retention policy and decide whether to ask about ZDR. Checked 12 Nov 2026:
- API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Commercial API data retention: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-commercial-api-data

## 12. Later ideas (not in the MVP)

- Save analyses locally to track score improvement over time
- Multiple tailored CV versions per role
- Interview prep questions based on the gaps
- Use the writing sample for rewrites as well as the letter
- A short, optional 'target industry' box for jobs that do not state it

## 13. Assumptions and open points

- UK English is used for all AI-written text: rewrites, advice and the cover letter. Confirmed.
- Models: Sonnet 5.5 for analysis, rewrites and cover letter; Sonnet 5.5 for the fact-check pass too (Haiku 5.5 over-flagged in testing). Both are switchable in `.env.local`.
- Cost: about two model calls per analysis, plus an optional third for the cover letter. Needs a funded Anthropic API key.
- LinkedIn and similar job URLs will usually fail to fetch, so the paste fallback matters.
- The score is a guide to how well the CV matches the role, not a prediction of any real ATS result.
- Known behaviour from live testing (not bugs): the model occasionally skips the summary rewrite; cover letters can come back amber for small embellishments (for example 'used Excel for reporting' when Excel is only in Skills); stronger-impact rewrites are sometimes flagged for adding outcomes the CV does not state; and a letter can come in a little under the 250 to 300 word aim. These are flagged, not hidden.
- Strict facts-only rules make the writing plainer than a person would write. The style checks, the voice read from the CV and the optional writing sample reduce this but cannot remove it, so every output should be read and edited before sending.
