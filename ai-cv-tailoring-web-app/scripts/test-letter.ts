// Offline checks for the cover letter helper. No API calls: a fake client stands in.
// Run: npx tsx scripts/test-letter.ts

import { jsonReply, kindOf } from "./test-utils";
import mammoth from "mammoth";
import { AnalysisError, MAX_CV_CHARS, MAX_JD_CHARS } from "../lib/claude";
import type { MessagesClient } from "../lib/claude-shared";
import { generateLetter, MAX_ACCEPTED, MAX_ACCEPTED_CHARS, MAX_LETTER_TOKENS } from "../lib/letter";
import { checkLetter, countWords } from "../lib/letter-checks";
import { buildLetterBuffer } from "../lib/letter-docx";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const CV = `Jane Sample

EXPERIENCE
Programme Manager, Example Council
- Led delivery of a customer portal migration across three teams
- Presented fortnightly progress updates to the steering group
- Managed a team of 6 analysts and cut reporting time by 20%

SKILLS
Stakeholder management, agile delivery`;
const JD = "Senior Programme Manager. Lead delivery, manage stakeholders. Experience with Jira and PRINCE2.";

/** A clean letter of the right length: no numbers, placeholders, clichés or gap keywords. */
function makeLetter(opts: { target?: number; extra?: string } = {}): string {
  const greeting = "Dear Hiring Manager,";
  const tail = `${opts.extra ?? ""}Kind regards,\nJane Sample`;
  const intro = "I led the customer portal migration across three teams and kept the steering group informed every fortnight.";
  // Padding made of distinct sentences (a repeated phrase would rightly trip the repeated-phrase style check).
  const subjects = ["Colleagues", "The first phase", "Our meetings", "Every fortnight", "The steering group", "New starters", "Each team", "The plan", "Early on", "Weekly notes", "The portal", "Support staff", "Managers", "Testing", "Training", "The budget", "Our records", "The timetable", "Careful planning", "Open questions", "The final month", "Shared goals", "The design", "Clear roles", "Regular checks", "The handover", "Quiet days", "Busy weeks", "The launch", "Later reviews", "Small fixes"];
  const verbs = ["shared", "reviewed", "recorded", "agreed", "tested", "explained", "checked", "settled", "tracked", "raised", "closed", "planned", "named", "sorted", "mapped", "framed", "traced", "listed", "tidied", "refined", "drafted", "weighed", "sampled", "briefed", "paced", "scoped", "logged", "ordered", "clarified", "revisited", "confirmed"];
  const nouns = ["next steps", "task owners", "recent changes", "open risks", "working pieces", "key dates", "main questions", "simplest route", "shared files", "weekly targets", "service gaps", "user needs", "handover notes", "team limits", "daily tasks", "release steps", "known issues", "style choices", "spare time", "tight spots", "fresh ideas", "old habits", "quick wins", "hard calls", "loose ends", "fair trades", "slow parts", "joined threads", "clean breaks", "early signs", "final checks"];
  const fillerSentences = subjects.map((sub, i) => `${sub} ${verbs[i]} the ${nouns[i]} and the ${nouns[(i + 7) % nouns.length]}.`);
  const filler = " " + fillerSentences.join(" ");
  const bodyWords = Math.max((opts.target ?? 270) - countWords(greeting) - countWords(tail), 20);
  const body = (intro + filler.repeat(Math.ceil(bodyWords / 240))).split(/\s+/).slice(0, bodyWords).join(" ");
  return `${greeting}\n\n${body}\n\n${tail}`;
}

const usageOf = (i: number, o: number) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
type Call = { params: Record<string, unknown> };
type Script = { letters: unknown[]; verdicts?: unknown[] | "throw" };

function fakeClient(script: Script) {
  const letterCalls: Call[] = [];
  const verdictCalls: Call[] = [];
  let l = 0;
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const tool = kindOf(params);
        if (tool === "submit_letter_verdict") {
          verdictCalls.push({ params });
          if (script.verdicts === "throw") throw new Error("boom");
          const vs = script.verdicts ?? [{ supported: true, unsupportedClaims: [] }];
          return jsonReply(vs[Math.min(verdictCalls.length - 1, vs.length - 1)], usageOf(300, 40));
        }
        letterCalls.push({ params });
        const input = script.letters[Math.min(l++, script.letters.length - 1)];
        return jsonReply(input, { ...usageOf(1200, 400), cache_creation_input_tokens: 700 });
      },
    },
  } as unknown as MessagesClient;
  return { client, letterCalls, verdictCalls };
}

const base = { cv: CV, jd: JD, accepted: [] as { id: string; text: string }[], gapKeywords: ["Jira", "PRINCE2"] };
const msg = (c: Call) => (c.params.messages as { content: string }[])[0].content;

async function rejects(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof AnalysisError ? e : null;
  }
}

async function main() {
  const good = makeLetter();
  check("test letter is 250 to 300 words", countWords(good) >= 250 && countWords(good) <= 300);

  // ---------- Happy path ----------
  {
    process.env.ANTHROPIC_MODEL = "main-from-env";
    process.env.ANTHROPIC_FAST_MODEL = "fast-from-env";
    const accepted = [{ id: "B5", text: "Cut reporting time by 15% through a new weekly process." }];
    const { client, letterCalls, verdictCalls } = fakeClient({ letters: [{ letter: good }] });
    const out = await generateLetter({ ...base, accepted }, client);

    check("one letter call and one fact-check call", letterCalls.length === 1 && verdictCalls.length === 1);
    check("clean letter is supported with no issues or notes", out.verification === "supported" && out.issues.length === 0 && out.styleNotes.length === 0);
    check("word count returned", out.wordCount === countWords(good));
    check("tokens are totalled across both calls", out.usage.input === 1500 && out.usage.output === 440 && out.factCheckUsage?.input === 300);
    check("accepted rewrites counted", out.acceptedUsed === 1);

    const l = letterCalls[0].params as { model: string; max_tokens: number; thinking?: unknown; system: { text: string; cache_control?: unknown }[]; output_config: { format: { type: string } } };
    check("letter uses the main model from the environment", l.model === "main-from-env");
    check("letter output is capped", l.max_tokens === MAX_LETTER_TOKENS && l.max_tokens <= 1200);
    check("structured JSON output is requested and thinking is switched off", l.output_config.format.type === "json_schema" && (l.thinking as { type: string } | undefined)?.type === "disabled" && !("tool_choice" in l));
    check("system prompt is cached and has no CV or job text", !!l.system[0].cache_control && !l.system[0].text.includes("Led delivery") && !l.system[0].text.includes("Jira"));
    check("CV bullets, accepted rewrites and job description are in the user message", msg(letterCalls[0]).includes("B3: Led delivery") && msg(letterCalls[0]).includes("Cut reporting time by 15%") && msg(letterCalls[0]).includes("Jira"));
    check("system prompt sets the rules (250 to 300 words, UK English, leave out what the CV lacks)", /Between 265 and 295 words/.test(l.system[0].text) && /do not use any of them/.test(l.system[0].text) && /UK English/.test(l.system[0].text) && /Leave it out/.test(l.system[0].text) && /passionate/.test(l.system[0].text));

    const f = verdictCalls[0].params as { model: string; max_tokens: number; system: { cache_control?: unknown; text: string }[]; thinking?: unknown };
    check("fact-check uses the fast model from the environment", f.model === "fast-from-env");
    check("fact-check output is capped and thinking is switched off", f.max_tokens <= 800 && (f.thinking as { type: string } | undefined)?.type === "disabled");
    check("fact-check system prompt is cached with no CV text", !!f.system[0].cache_control && !f.system[0].text.includes("Led delivery"));
    const fm = msg(verdictCalls[0]);
    check("fact-check sees the whole CV, the approved rewrites and the letter, but not the job description", fm.includes("B6: Stakeholder management") && fm.includes("Cut reporting time by 15%") && fm.includes(good.slice(0, 40)) && !fm.includes("Jira"));
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_FAST_MODEL;

    const d = fakeClient({ letters: [{ letter: good }] });
    await generateLetter(base, d.client);
    check("default model names used when variables are unset", (d.letterCalls[0].params as { model: string }).model === "claude-sonnet-5-5" && (d.verdictCalls[0].params as { model: string }).model === "claude-sonnet-5-5");
  }

  // ---------- A number the user typed in an accepted rewrite is allowed; an invented one is not ----------
  {
    const allowed = fakeClient({ letters: [{ letter: makeLetter({ extra: "I cut reporting time by 15% in my last role.\n\n" }) }] });
    const ok = await generateLetter({ ...base, accepted: [{ id: "B5", text: "Cut reporting time by 15%." }] }, allowed.client);
    check("a number from the user's accepted rewrite is allowed", ok.verification === "supported" && allowed.verdictCalls.length === 1);

    const bad = fakeClient({ letters: [{ letter: makeLetter({ extra: "I improved delivery by 40% and managed a budget of 2 million.\n\n" }) }] });
    const flagged = await generateLetter(base, bad.client);
    check("invented numbers flag the letter amber and name them", flagged.verification === "check" && /40/.test(flagged.issues.join(" ")) && /2/.test(flagged.issues.join(" ")));
    check("flagged letter skips the model fact-check", bad.verdictCalls.length === 0 && flagged.factCheckUsage === null);
    check("the flagged letter is still returned for editing", flagged.letter.includes("40%"));
  }

  // ---------- Placeholders and gap keywords ----------
  {
    const ph = fakeClient({ letters: [{ letter: makeLetter({ extra: "I cut costs by [X%].\n\n" }) }] });
    const r1 = await generateLetter(base, ph.client);
    check("a leftover [placeholder] is flagged and skips the model check", r1.verification === "check" && /placeholder/i.test(r1.issues.join(" ")) && ph.verdictCalls.length === 0);

    const gap = fakeClient({ letters: [{ letter: makeLetter({ extra: "I have used Jira to run delivery.\n\n" }) }] });
    const r2 = await generateLetter(base, gap.client);
    check("a gap keyword in the letter is flagged and skips the model check", r2.verification === "check" && /Jira/.test(r2.issues.join(" ")) && gap.verdictCalls.length === 0);

    const noGap = fakeClient({ letters: [{ letter: good }] });
    const r3 = await generateLetter({ ...base, gapKeywords: [] }, noGap.client);
    check("no gap keywords supplied: nothing flagged", r3.verification === "supported");
  }

  // ---------- Style notes do not make it amber, and the model check still runs ----------
  {
    const style = fakeClient({ letters: [{ letter: makeLetter({ extra: "I am writing to apply because I am passionate about delivery and I organized the team.\n\n" }) }] });
    const r = await generateLetter(base, style.client);
    const notes = r.styleNotes.join(" ");
    check("banned opener, cliché and US spelling become quiet notes", /writing to apply/.test(notes) && /passionate/.test(notes) && /US spelling/.test(notes));
    check("style notes alone do not flag the letter and the fact-check still runs", r.verification === "supported" && style.verdictCalls.length === 1);

    const short = fakeClient({ letters: [{ letter: "Dear Hiring Manager,\n\nI led the customer portal migration.\n\nKind regards,\nJane Sample" }] });
    const r2 = await generateLetter(base, short.client);
    check("a letter outside 250 to 300 words gets a word-count note and is not regenerated", r2.styleNotes.some((n) => /words\. The aim is 250 to 300/.test(n)) && short.letterCalls.length === 1);
  }

  // ---------- Fact-check outcomes ----------
  {
    const unsupported = fakeClient({ letters: [{ letter: good }], verdicts: [{ supported: false, unsupportedClaims: ["Claims to have run the programme budget"] }] });
    const r = await generateLetter(base, unsupported.client);
    check("unsupported claim gives amber with the claim named", r.verification === "check" && r.issues[0].includes("programme budget"));

    const invalid = fakeClient({ letters: [{ letter: good }], verdicts: [{ nonsense: true }] });
    const r2 = await generateLetter(base, invalid.client);
    check("invalid fact-check output goes amber with one request only", r2.verification === "check" && invalid.verdictCalls.length === 1);

    const thrown = fakeClient({ letters: [{ letter: good }], verdicts: "throw" });
    const r3 = await generateLetter(base, thrown.client);
    check("fact-check API failure goes amber with no retry, letter still returned", r3.verification === "check" && thrown.verdictCalls.length === 1 && r3.letter === good);
  }

  // ---------- Points the checker has itself cleared are not problems ----------
  {
    const cleared = fakeClient({ letters: [{ letter: good }], verdicts: [{ supported: false, unsupportedClaims: ["Role mirrors experience (job wording, not counted)", "Led delivery is fine but ok"] }] });
    const rc = await generateLetter(base, cleared.client);
    check("when every listed point is one the checker cleared, the letter is not amber", rc.verification === "supported" && rc.issues.length === 0);
    const mixed = fakeClient({ letters: [{ letter: good }], verdicts: [{ supported: false, unsupportedClaims: ["Role mirrors experience (not counted)", "Says Python was used every day; CV does not say"] }] });
    const rm = await generateLetter(base, mixed.client);
    check("a real problem is kept and the cleared point is dropped", rm.verification === "check" && rm.issues.length === 1 && /every day/.test(rm.issues[0]));
    const bare = fakeClient({ letters: [{ letter: good }], verdicts: [{ supported: false, unsupportedClaims: [] }] });
    const rb = await generateLetter(base, bare.client);
    check("'not supported' with no reasons given stays amber", rb.verification === "check" && rb.issues.length === 1);
  }

  // ---------- Retry and limits ----------
  {
    const bad = fakeClient({ letters: [{ nonsense: true }] });
    const e = await rejects(() => generateLetter(base, bad.client));
    check("invalid letter output: exactly one retry, then a clear error", bad.letterCalls.length === 2 && e?.status === 502 && bad.verdictCalls.length === 0);

    const recover = fakeClient({ letters: [{ nonsense: true }, { letter: good }] });
    const r = await generateLetter(base, recover.client);
    check("a retry can recover", recover.letterCalls.length === 2 && r.usage.input === 2400 + 300);

    const never = fakeClient({ letters: [{ letter: good }] });
    const e1 = await rejects(() => generateLetter({ ...base, cv: "x".repeat(MAX_CV_CHARS + 1) }, never.client));
    const e2 = await rejects(() => generateLetter({ ...base, jd: "x".repeat(MAX_JD_CHARS + 1) }, never.client));
    check("oversized input rejected before any API call", e1?.status === 413 && e2?.status === 413 && never.letterCalls.length === 0 && never.verdictCalls.length === 0);

    const many = Array.from({ length: 15 }, (_, i) => ({ id: `B${i + 1}`, text: "y".repeat(MAX_ACCEPTED_CHARS + 200) }));
    const capped = fakeClient({ letters: [{ letter: good }] });
    const rc = await generateLetter({ ...base, accepted: many }, capped.client);
    check("accepted rewrites are capped in number and length", rc.acceptedUsed === MAX_ACCEPTED && !msg(capped.letterCalls[0]).includes("y".repeat(MAX_ACCEPTED_CHARS + 1)));
  }

  // ---------- Letters echo the employer's wording; only claims about the candidate are flagged ----------
  {
    const gap = ["cross-functional", "digital transformation", "portfolio"];
    const echo = "That is the closest match to the cross-functional delivery your role describes. I would welcome the chance to discuss how I could contribute to your portfolio of digital transformation programmes.";
    check("echoing the employer's wording ('your portfolio...', 'your role describes') is not flagged", checkLetter(echo, CV, gap).factIssues.length === 0);
    const claim = "I have years of cross-functional digital transformation experience across a large portfolio.";
    const flagged = checkLetter(claim, CV, gap).factIssues.join(" ");
    check("claiming the same terms about yourself is flagged", /cross-functional/.test(flagged) && /digital transformation/.test(flagged));
    check("named tools are flagged on any mention, even beside 'your'", checkLetter("I am keen to learn the Jira boards your team uses.", CV, ["Jira"], ["Jira"]).factIssues.length === 1);
    check("a different ending in the CV counts as showing the term ('reporting' vs 'Reported on')", checkLetter("My reporting was clear.", "Reported on campaign results monthly.", ["reporting"], []).factIssues.length === 0);
    check("a term the CV does contain is never flagged", checkLetter("I use agile delivery every day.", CV, ["agile delivery"], []).factIssues.length === 0);
  }

  // ---------- The letter is told which terms to avoid ----------
  {
    const { client, letterCalls } = fakeClient({ letters: [{ letter: good }] });
    await generateLetter({ ...base, gapKeywords: ["Jira", "budget management"] }, client);
    const m = msg(letterCalls[0]);
    check("the letter request lists the terms the CV doesn't show", m.includes("Do not use any of these in the letter") && m.includes("budget management") && m.includes("Jira") && m.includes("PRINCE2"));
    check("the avoid-list comes before the job description", m.indexOf("Do not use any of these") < m.indexOf("Job description:"));
  }

  // ---------- Pure checks ----------
  {
    const c = checkLetter("We organized things in a program at the center.", CV, []);
    check("US spellings are noticed", c.styleNotes.filter((n) => /US spelling/.test(n)).length === 2);
    check("'programme' and plain words are not flagged", checkLetter("I managed the programme and organised the centre.", CV, []).styleNotes.every((n) => !/US spelling/.test(n)));
    check("a gap keyword that is also in the CV is not flagged", checkLetter("I use agile delivery.", CV, ["agile delivery"]).factIssues.length === 0);
  }

  // ---------- Word file ----------
  {
    const buf = await buildLetterBuffer(good);
    const raw = (await mammoth.extractRawText({ buffer: buf })).value;
    const html = (await mammoth.convertToHtml({ buffer: buf })).value;
    check("DOCX opens and contains the letter text", raw.includes("Dear Hiring Manager,") && raw.includes("Kind regards,") && raw.includes("Jane Sample"));
    check("DOCX has no tables or images", !/<table|<img/i.test(html));
    check("DOCX keeps the paragraphs", (html.match(/<p>/g) ?? []).length >= 3);
  }

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
