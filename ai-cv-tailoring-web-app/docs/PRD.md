# FastTrack: Product Requirements Document

Owner: Naomi · Version 0.6 (guided flow, with review mode) · 20 Nov 2026 · Local-only web app

This file is the source of truth for the build. Save it in the project as `docs/PRD.md`. The build prompts are in `PROMPTS.md`.

**Changes since 0.5 (20 Nov 2026): review mode and tailoring quality.** The draft step has a one-change-at-a-time review mode (original and new wording side by side with word-level differences, problems first, keep or use my original, keep all safe changes, keyboard keys, a sticky counts bar), and the whole-CV view now puts each numbered note beside the line it explains. The draft now works through the whole CV role by role, moves skills to the front on every skills line, uses my answers and notes by working them into the right sentence rather than tacking them on (and says when an answer was not used), keeps finance wording for finance jobs and drops it for other sectors, and keeps my CV's own apostrophe style so a quote swap is never shown as a change. Reordering now recognises longer dated role lines. Word line breaks are read as spaces. The summary may now use facts from my answers and notes. Sections 4, 5, 6, 7, 8 and 13 are updated.

**Changes since 0.4 (20 Nov 2026):** the draft can now reorder the bullets inside one role (checked in code, applied in every download, and revertible with 'Use my original order'); the draft says why a confirmed term could not be added to the skills line; a line that claims an unshown requirement in other words is flagged amber; and internal bullet IDs are never shown. Sections 4, 5, 8, 9, 12 and 13 are updated.

**Changes since 0.3 (20 Nov 2026): the guided flow.** Five tabs, per-bullet accepting and placeholder forms were too much manual work. The app now follows one guided path, like a Claude project: add the CV and job, read one assessment (score out of 100, strengths, gaps, a requirements table, a tailoring plan), answer a few clarifying questions, then see a drafted CV that I can rework with one instruction or download in the original layout. My typed answers and an optional notes box now count as evidence, alongside the CV, so placeholders are gone: anything I do not answer is left out, never invented. Sections 3 to 9, 11, 12 and 13 are updated; the truthfulness rules (section 7) are unchanged in strength.

**Changes since 0.2 (added after the MVP, 13 Nov 2026):** the personal summary is now rewritten (F12); every rewrite is tailored to the role and industry, with a visible 'how I read this role' panel (F13); skills sections are never rewritten but get a 'skills to move to the front' list (F14); a shared style guide, style checks and a voice read from the CV make the writing sound like the user (F15); and an optional writing sample shapes the cover letter's tone (F16). Keyword matching also accepts a different word ending for plain words ('train' and 'Trained'). Sections 2, 4, 5, 7, 8, 9, 10, 11, 12 and 13 are updated to match.

## 1. The core problem

Strong candidates get filtered out because their CV describes duties instead of business impact, and does not use the language of the role. Existing AI CV tools make this worse: they either give generic buzzword rewrites or invent numbers and skills to make the CV match.

**Problem statement:** I need a tool that reads my real CV and a specific job description, tells me honestly how well they match, and shows me how to reword my own experience to land the right impact and keywords, without making anything up and without losing my voice.

## 2. Product principles

- **Truth first.** Every suggestion must be traceable to something in the CV, or to what I have told the app in my answers or notes. No invented employers, tools, metrics, titles or outcomes.
- **Authentic, not generic.** The draft keeps my facts and my vocabulary, and is tailored to the role without claiming anything new. I can always rework it or use my original line.
- **Sounds like me.** Written output should not read as machine-made: plain words, my own verbs, no stock phrases. The app flags machine-sounding wording rather than hiding it.
- **Impact over duties.** The draft pushes toward outcome, scale and result, and the app asks me for the real numbers before drafting rather than guessing them.
- **Explain why.** Every score and suggestion has a short reason I can check.
- **Basic and clear.** One page, one guided path, one accent colour, plain typography. No clutter.
- **Lean on tokens.** Few model calls, short outputs, and the cheapest model that does each job well.

## 3. Goals and non-goals

**MVP goals**
- Upload a CV (PDF, Word or pasted text) and give a job description (URL or pasted text).
- Return one match score out of 100 with a reason, strengths and gaps backed by evidence from the CV, a requirements table (Yes, Partial, No), a plain-words plan for tailoring, and a few clarifying questions, all before anything is drafted.
- Draft a tailored CV (including the personal summary) from the CV plus my answers, let me rework it with one instruction, and export it in the original layout. An optional cover letter uses only facts from the CV, my answers and my notes.
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
- **F2b. Notes (optional).** A box for background that is not on the CV (side projects, other roles, tools I have used). It counts as evidence, like my answers, and is held in memory only.
- **F3. Fit assessment.** One score out of 100 with a one-line reason. It is the model's calibrated judgement of how well my experience matches what the role asks for (it is told not to inflate), clamped to 0 to 100 in code.
- **F4. Working well.** Three to five short bullets (a label and one sentence), each with an evidence line from my CV: 'From your CV (B3): "exact quote"'. A bullet with no verified quote is dropped.
- **F5. Gaps.** Short bullets for what the role asks for that the CV does not show, naming the nearest real experience if there is one, and honest about it ('your CV never mentions a budget'). A gap never suggests claiming something that is not true.
- **F6. Keywords and requirements.** A table of the role's requirements and keywords with 'On your CV?' as Yes, Partial (with a note) or No (with a note). Yes is checked in code against the CV; a Yes that cannot be backed up is shown as Partial. A No is a genuine gap and is never put into the draft unless my answer or notes confirm it.
- **F7. How the CV would be tailored.** Three to six bullets, each tagged Reword, Reorder, Shorten or Cut, saying what will change and why (summary, which bullets lead, wording), without the rewritten text. It may suggest shortening or cutting content that is not relevant to the job, such as an old unrelated role or bullets that add nothing for this role. It prefers shortening (keep the title, employer and dates, reduce to a line or a couple of bullets) to removing a whole role, because removing one leaves a gap in the timeline, and it never cuts or shortens something the role asks for. Anything that depends on something unconfirmed says so ('only added if you confirm it below').
- **F8. Questions before drafting.** Three to five clarifying questions about requirements or keywords the CV does not clearly show, a figure that is missing, or a fact the CV states two ways. Each has a text box, a Skip tick and a line saying what happens if I skip it. One 'Draft my CV' button follows.
- **F9. Truthfulness guardrails (cross-cutting).** See section 7.
- **F10. Draft, rework and export.** The draft is the CV with changed lines only (the personal summary and up to about 12 lines), shown as a CV page with the changes marked and a list of what changed and why, each with its source (a CV bullet, one of my answers, or my notes). The draft may also reorder the bullets under one role, shown as a 'Moved' entry with the new order and a 'Use my original order' button. A reorder is accepted only if it is exactly a reordering of one role's bullets, with no cut line in it, so nothing is added or lost. It relies on the role line carrying dates; where a role cannot be told apart, nothing is moved. A line the fact-check flags is shown amber with the reason and a 'Use my original' button. Changes can be reviewed one at a time or on the whole CV (see section 5). A change that only swaps a curly apostrophe or quotation mark for a straight one, or the reverse, is never shown: the draft keeps the CV's own style. Cuts and shortenings are applied only where the assessment suggested them, are shown as removed or shortened lines, and can be restored the same way. One instruction box ('shorter', 'lead with stakeholders', 'keep that line out') redrafts the whole CV. Download keeps the original CV's look: a Word upload is edited in place, so its font, sizes, layout and margins are exactly as uploaded (the file stays in the browser tab's memory); a PDF upload is rebuilt as a Word file that matches the detected font, sizes, bold headings and margins as closely as possible (a close match, not identical); pasted text uses a plain layout. A plain, single-column ATS-friendly version is always available.
- **F11. Cover letter helper.** An optional short tailored letter using only facts from my CV, my answers and my notes, in my own voice, editable and exportable. Generated only when I ask for it. Quiet style notes show word count, machine-sounding wording and repeated phrases.
- **F12. Personal summary.** If the CV has a summary, profile or personal statement, its paragraph is always part of the draft. It is tailored to the role like any other line but is held to a stricter rule: it keeps every number, employer and brand exactly as written and may not introduce a name or number that is not in the original paragraph, my answers or my notes. It may use facts from my answers and notes (worked in, see F17), never a fact that only the job description states, and it stays short (about three sentences).
- **F13. Role and industry tailoring.** The assessment first reads the job (industry, seniority, top priorities) and the draft leads with what matches those priorities. When the job is in a different industry from the CV, sector-specific wording may be restated in neutral, still-true terms (for example 'creative approved through a formal compliance review'). The app never claims experience in the target industry and never broadens the scope or strength of a claim. A code check removes a summary clause that leans on a sector or regulation word (FCA, regulated, financial services and similar) the job description never uses, but only when the job is not itself in finance: for a bank, fintech or other regulated financial job those words are kept and led with.
- **F14. Skills sections.** Skills lines are lists of tools, so the model never rewrites them (code rejects any such change). Code may add terms to the skills line only when the requirements table shows them as Yes or my answers or notes confirm them, and may move skills already on the line to the front, on every skills line that is a list (an item such as 'SQL (MySQL, PostgreSQL)' stays whole). It never removes or renames an item, and it only touches a line written as a list.
- **F15. Voice and style.** The assessment reads how I write from my own CV (person, tense, sentence length, formality, punctuation, and verbs I use, each checked against the CV). The draft and the letter try to match it. A shared style guide is part of every prompt, and token-free code checks flag machine-sounding words, em dashes, repeated openers, stock phrases and very long sentences as quiet notes. Style never overrides the truthfulness rules.
- **F16. Writing sample (optional).** Before generating the cover letter I can paste up to 2,000 characters of my own writing (an email, an old letter). It is used only for tone and rhythm, never as a source of facts, is sent only when I click Generate, and is never stored or logged.
- **F17. Answers and notes worked in.** My answers and notes are new evidence, so the draft decides where each belongs (the summary for a headline strength, the most relevant bullet for extra detail, or both) and rewrites the whole sentence around it, keeping my verbs and the line's original result. It is never stuck on the end of a line. A code check adds a quiet style note when a new line is just the original with words appended. If an answer or my notes were not used anywhere, a note says so and points to the rework box, so nothing is silently dropped. If no line can take an answer naturally it is left out rather than forced in.

## 5. Basic UI

One page with a simple, guided flow and plain styling. A small step indicator shows Inputs, Assessment, Draft.
- **Step 1, Inputs:** CV (upload or paste), job description (paste or URL), an optional notes box, and one 'Assess my CV' button. The CV and job description boxes always line up, whatever is pasted or fetched: both have a fixed-height area above a fixed-height text box, and messages appear below the box.
- **Step 2, Assessment:** one scrolling page: the score, Working well, Gaps, Keywords and requirements (table), How I'd tailor your CV, then Questions before I draft anything with a 'Draft my CV' button.
- **Step 3, Draft:** a sticky bar with the counts (changes, need a look, reviewed) and a Download button, then two ways to check the changes. **Review one by one** (the default) shows one change at a time ('Change 3 of 12'): changes that need a look come first; the original and the new wording sit side by side with word-level differences (removed words struck through, added words underlined, words that only moved with a dashed underline; letter case, punctuation and apostrophe style are ignored); the reason is one line; the source quote and style notes are behind a disclosure and any warning is always visible; 'Keep and next' and 'Use my original'; 'Keep all N safe changes' never touches a flagged line; left and right arrows, K and U work, with screen-reader announcements. **Whole CV** shows the CV page with a numbered marker on each changed line and its numbered note in the same row beside it (stacked under the line on a narrow screen). Below are a 'Want it changed?' box with a Rework button, Download in the original format, and an optional cover letter button.
- Design: white background, dark grey text, one accent colour, system font, generous spacing, no animations, clear loading and error states. Status is never shown by colour alone (each state has an icon and a word), controls are keyboard operable and have visible focus, and the layout meets WCAG 2.2 AA.
- Results stay in the browser tab's memory, so moving between steps never triggers another API call.

## 6. Workflow

1. Add CV (upload or paste) and review the extracted text. Optionally add notes.
2. Add job description (URL or paste) and review the extracted text.
3. Click Assess. The app splits the CV into numbered bullets and makes one main call (strict no-fabrication rules). The model first reads the role and my writing style, then writes the score, strengths, gaps, requirements table, tailoring plan and questions.
4. The app validates the response against a schema and checks every quote in code.
5. I read the assessment and answer the questions (or skip them).
6. Click Draft my CV. A second main call drafts the changed lines using only the CV, my answers and my notes. Code checks each line, then one batched call to the fast model fact-checks all lines at once.
7. I review the draft one change at a time (or on the whole CV). I can use my original for any line, keep all the safe changes at once, give one instruction to redraft, or download the CV in its original format.
8. Optionally, I paste a sample of my own writing, then generate and edit a cover letter and export it.

## 7. Truthfulness guardrails (the most important requirement)

My own typed answers and my notes are evidence, because they are my own statements. The CV, my answers and my notes are the only sources of facts.

- **Evidence required.** Every strength, gap, requirement marked Yes and draft line must cite a source: a CV bullet ID with an exact quote, one of my answers ('Answer 2'), or my notes (with a quote from them). No evidence means the item is dropped (the summary is kept amber with a reason). Quotes are checked in code, which costs no tokens.
- **No invented numbers.** A draft line may only use figures that appear in the original line, my answers or my notes. Equivalent notations ('£5M+', '£5+ million') are the same figure. There are no placeholders: if I do not give a figure, none is used.
- **No invented skills, tools or titles.** Requirements marked No are never injected into the draft or the skills line unless my answer or notes confirm them.
- **Verification pass.** One batched call (fast model, all draft lines in one request) compares each line to the original bullet, the rest of the CV (sent as numbered bullets, so a line can draw on the same role but not borrow from a different one), and my answers and notes, and flags unsupported claims. A code-level check also rejects any digit that is not in the original line, my answers or my notes. The verification stays a separate call, not part of the draft call, so the draft is not marking its own work.
- **Voice preservation.** Drafts keep my vocabulary and sentence style where possible. The voice read from my CV only lists verbs that really appear in it. Machine-sounding wording ('leverage', 'spearhead', 'proven track record', em dashes and similar) is discouraged in the prompts and flagged by code, and clichés such as 'results-driven' or 'passionate' are never wanted.
- **Summary guard.** A summary line is flagged in code if it adds a number or a name (employer, brand, regulator, tool) that the original paragraph, my answers and my notes do not contain. The fact-check applies the same test strictly to the summary, treating facts in my answers and notes as supported. The summary is always shown, amber with the reason, rather than dropped.
- **Transferable reframing, not new claims.** Restating sector-specific wording in neutral, still-true terms is allowed for a job in a different industry. Adding a sector, regulator, customer type, outcome, number or scope word borrowed from the job description is not. Tailoring is by emphasis and wording, not by adding detail.
- **Skills lines are never rewritten by the model.** Code rejects any such change. Only the deterministic skills-line step (F14) may add confirmed terms.
- **UK English.** All AI-written text uses UK English.
- **Human in the loop.** Nothing is final until I download it. I can use my original for any flagged line and redraft with one instruction. The questions ask me before anything is drafted, so I confirm what is true.

## 8. Model output (data contract)

The backend asks Claude for structured JSON that is validated with a schema. There are two model-facing contracts, kept small and flat.

**Assessment (call 1)**
- `roleIndustry`, `roleSeniority`, `rolePriorities`, `voiceDescription`, `voiceVerbs`: flat strings returned first, so the model has read the job and my style before writing anything. Code turns them into `roleContext` (industry, seniority, up to 5 priorities) and `voice` (description, up to 8 verbs that must appear in the CV). They are flat because nested or optional fields made the API's compiled output grammar too large.
- `score` (0 to 100) and `scoreReason` (one line). Code clamps the score.
- `strengths[]`: label, text, sourceBulletId, evidenceQuote (dropped in code if the quote is not in that bullet).
- `gaps[]`: label, text, optional sourceBulletId and evidenceQuote for the nearest real experience (cleared, not dropped, if the quote is wrong).
- `requirements[]`: requirement, status (yes, partial, no), note, sourceBulletId, evidenceQuote. Code downgrades a Yes that cannot be backed up in the CV to Partial. A plain lowercase single-word keyword counts as present if the CV has it with a different ending ('train' and 'Trained'); names, phrases and anything with capitals or digits stay exact.
- `plan[]`: label, action (reword, reorder, shorten or cut), text (what will change and why, no rewritten text). Code normalises an unknown action to reword.
- `questions[]`: text, ifSkipped (what happens if I skip it). Three to five.

**Draft (call 2)**
- `reorder[]`: each entry is all the bullet IDs under one role in the new order, comma separated, optionally followed by '|' and a short reason (for example 'B6,B4,B5|Leads with delivery'). Code accepts an entry only if it is exactly a permutation of one detected role's bullets, differs from the current order and contains no cut line. A role line is a short line (up to 20 words) with a date range and no bullet marker. `skillsToFront` may name up to 8 skills from any skills line.
- `changes[]`: sourceBulletId, newText, whatChanged, source ('B3', 'Answer 2' or 'Notes') and evidenceQuote. Code checks every change (known bullet, no repeats, no skills-line rewrite, numbers and names, style notes), adds `verification` and `issues[]` from the fact-check, and applies the confirmed skills-line terms itself.

## 9. Model choice and token strategy

**Goal:** fast, efficient and strong at structured reasoning, without weakening the analysis.

**Model choice**
- **Main model: Claude Sonnet 5.5** (`claude-sonnet-5-5`). Used for the assessment, the draft and the cover letter. It is quick, handles schema-constrained output and evidence-grounded reasoning well, and costs much less than the larger models.
- **Fact-check model: Claude Sonnet 5.5** (`claude-sonnet-5-5`, set as `ANTHROPIC_FAST_MODEL`). Used only for the fact-check passes, which are narrow comparison tasks. Haiku 5.5 (`claude-haiku-5-5`) was the original choice. In live testing on 12 Nov 2026 it caught all 5 planted unsupported rewrites and 2 of 2 unsupported keywords, the same as Sonnet, but on real output it over-flagged: all 4 cover letters came back amber, against 3 of 4 passing with Sonnet (the fourth was caught by a code check), and it flagged good rewrites and relevance statements. Haiku can still be set in `.env.local` to save a little cost.
- **Not used:** Opus-class is an optional upgrade if draft quality is not good enough, at higher cost. Fable and Mythos-class models are excluded because they require 30-day data retention (see section 11).
- Both names are read from `.env.local` (`ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL`), so they can be changed without touching code. Check Anthropic's pricing page for current rates.

**Token-saving rules**
1. **Two main calls plus one check.** The assessment (call 1) sends the CV and job description once and returns everything up to the questions. The draft (call 2) sends them again with my answers and notes. Each draft is then verified in one small batched fact-check call.
2. **One batched fact-check call.** All draft lines are verified in one request, not one request each.
3. **Cap the draft.** The personal summary and up to about 12 changed lines. Lines that do not need to change are not sent back.
4. **Trim the inputs.** Strip extra whitespace, page numbers, headers and footers from the CV, and cut boilerplate (benefits, equal opportunity text, company blurb) from the job description where it is easy to detect. Warn me if either input, or the notes, is very long, and enforce a maximum length.
5. **Cap the outputs.** Set `max_tokens` per call, and ask for short fields (for example, the score reason under 20 words, 'what changed' under 25 words).
6. **Cache only the static instructions.** The system prompt and schema are identical every run, so they can use prompt caching. The CV, job description, answers and notes go after the cached part, so they are never part of a cache entry.
7. **Keep thinking off by default.** The structured prompt does the reasoning work. Turn extended thinking on only if testing shows quality problems.
8. **Low temperature and one retry.** Retry once on a schema failure only. Never retry in a loop.
9. **On demand only.** The draft runs only after I click Draft my CV, a rework only when I click Rework, and the cover letter and the DOCX export only when I click them. Nothing is regenerated when I move between steps.
10. **Show usage, not content.** Log input and output token counts and timing for each call (never the text), and show a small 'tokens used this run' line, so costs stay visible.

**Expected usage:** the assessment is smaller than the old single analysis because it returns no rewrites. A first draft is three calls (assessment, draft, fact-check). Measured on a short fictional CV, the assessment used about 3,000 tokens and the draft with its fact-check about 3,000, so roughly 6,000 to 10,000 in total; a long CV costs more. Each rework repeats the draft and the fact-check (about 3,000 to 5,000 tokens). The optional cover letter adds its own call and check. A writing sample adds up to about 500 input tokens to the letter call only. Role reading, voice, style checks, reordering and skills-line changes add no extra calls.

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
- CV, job, notes and answer text go only to the Claude API, over HTTPS, from server-side code. The API key never reaches the browser.
- The text is used only for the assessment, the draft and the cover letter. No analytics, tracking or other third-party services.
- Nothing is stored: no database, no files, no logging of request or response bodies, no cookies, no browser storage. Closing the tab clears everything.
- API responses are sent with `Cache-Control: no-store` so nothing is cached.
- The optional writing sample is treated exactly like the CV: Claude API only, from server-side code, only when I click Generate cover letter, never stored or logged, and its use is limited to tone (the privacy audit checks that only the cover letter UI, route and letter code handle it).
- The UI states this plainly next to the Analyse button, and the cover letter section says the same before sending.

**What the app cannot guarantee (Anthropic controls this)**
- Anthropic's API documentation says prompts and outputs are not retained by default, while its privacy centre says API inputs and outputs are deleted within 30 days. The two pages word it differently, so check the current policy before relying on either. Content flagged for policy violations can be kept longer.
- A guarantee of no retention needs a zero data retention (ZDR) arrangement, which Anthropic agrees per organisation through its sales team. Code cannot switch it on.
- Anthropic's documentation says its newest top-tier models (Fable and Mythos class) require 30-day retention and are not available under ZDR unless authorised. Sonnet 5.5 and Haiku 5.5 are the chosen models.
- Anthropic's documentation says retained data is never used for model training without express permission.

**Suggested UI wording:** 'Your CV, job description, notes and answers are sent securely to the Claude API only to produce your assessment, draft and cover letter. This app does not store them. Anthropic's own retention policy applies on its side.'

**Before using a real CV:** read Anthropic's retention policy and decide whether to ask about ZDR. Checked 12 Nov 2026:
- API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Commercial API data retention: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-commercial-api-data

## 12. Later ideas (not in the MVP)

- Save analyses locally to track score improvement over time
- Multiple tailored CV versions per role
- Upload several CV versions and check them against each other for conflicts
- Interview prep questions based on the gaps
- Use the writing sample for the draft as well as the letter
- Edit a line by hand before downloading (today the choices are 'Use my original' or a rework)
- Show the real Word layout in the preview (for example by rendering the edited .docx in the page)
- Reorder across roles or sections, and recognise undated role lines when reordering
- An automated accessibility scan (for example axe in a headless browser)
- A short, optional 'target industry' box for jobs that do not state it

## 13. Assumptions and open points

- UK English is used for all AI-written text: the assessment, the draft and the cover letter. Confirmed.
- Models: Sonnet 5.5 for the assessment, draft and cover letter; Sonnet 5.5 for the fact-check pass too (Haiku 5.5 over-flagged in testing). Both are switchable in `.env.local`.
- Cost: about three model calls for a first draft (assessment, draft, fact-check), two more for each rework, and an optional cover letter with its own check. Needs a funded Anthropic API key.
- LinkedIn and similar job URLs will usually fail to fetch, so the paste fallback matters.
- The score is a guide to how well the CV matches the role, not a prediction of any real ATS result.
- Known limits: a Word CV where a heading shares a paragraph with the next line (joined by Shift+Enter) is read as one line, so its sections are not detected; reordering is refused for PDF uploads, whose text cannot be split into roles reliably; and a line break inside a Word paragraph is read as a space.
- Known behaviour from live testing (not bugs): the model sometimes returns your original summary, amber, instead of a new one (so a summary is always shown); a cover letter can come in a little under the 250 to 300 word aim; code can only catch a claim that uses a requirement's own distinctive word, so a claim phrased very differently is left to the fact-check; and the model's first plan sometimes asks for a reorder that code then refuses because it is not a clean reordering of one role. These are flagged or explained, not hidden.
- Strict facts-only rules make the writing plainer than a person would write. The style checks, the voice read from the CV and the optional writing sample reduce this but cannot remove it, so every output should be read before sending. The app has been tested on fictional CVs, so check the first real run against your own CV.
