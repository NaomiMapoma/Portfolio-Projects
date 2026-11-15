// Live honesty and token hardening run. Uses the REAL Claude API and costs a few
// pence of tokens. Needs ANTHROPIC_API_KEY in .env.local.
//
//   npx tsx --env-file=.env.local scripts/hardening-live.ts
//
// For each of three CV and job description pairs plus a red-team pair it runs a
// real analysis and a real cover letter and checks: quotes exist, no invented
// numbers, absent skills never appear in claims, UK English, call counts and
// models, and prints real token counts per call. Then it compares the fast and
// main models on the fact-check using planted good and bad rewrites.

import { kindOf } from "./test-utils";
import { quoteIn, sectionKind, splitCv } from "../lib/bullets";
import { analyse, getClient } from "../lib/claude";
import type { MessagesClient } from "../lib/claude-shared";
import { factCheck, type KeywordClaim } from "../lib/factcheck";
import { containsStem, containsTerm, jdOnlyTerms } from "../lib/keywords";
import { generateLetter } from "../lib/letter";
import { checkLetter } from "../lib/letter-checks";
import { fastModel, mainModel } from "../lib/models";
import { invalidNumbers } from "../lib/numbers";
import type { Rewrite } from "../lib/types";
import { PAIRS, PLANTED, PLANTED_KEYWORDS, RED_TEAM, type Pair } from "./fixtures/pairs";
import { US_WORDS } from "./audit-uk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("No ANTHROPIC_API_KEY found. Copy .env.local.example to .env.local, add your key, and run:\n  npx tsx --env-file=.env.local scripts/hardening-live.ts");
  process.exit(2);
}

let failures = 0;
const notes: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  [${detail}]` : ""}`);
  if (!ok) failures++;
}

type CallLog = { tool: string; model: string; maxTokens: number; ms: number; input: number; output: number; cacheRead: number; cacheWrite: number; stop: string };
const log: CallLog[] = [];

/** Wraps the real client so every call is counted and its real token usage recorded. */
function countingClient(): MessagesClient {
  const base = getClient();
  return {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const started = Date.now();
        const res = await (base.messages as unknown as { create(p: unknown): Promise<{ usage: Record<string, number | null>; stop_reason: string }> }).create(params);
        log.push({
          tool: kindOf(params),
          model: String(params.model),
          maxTokens: Number(params.max_tokens),
          ms: Date.now() - started,
          input: Number(res.usage.input_tokens ?? 0),
          output: Number(res.usage.output_tokens ?? 0),
          cacheRead: Number(res.usage.cache_read_input_tokens ?? 0),
          cacheWrite: Number(res.usage.cache_creation_input_tokens ?? 0),
          stop: res.stop_reason,
        });
        return res;
      },
    },
  } as unknown as MessagesClient;
}

function printCalls(since: number) {
  for (const c of log.slice(since)) {
    console.log(`        ${c.tool.padEnd(22)} ${c.model.padEnd(20)} in=${String(c.input).padStart(5)} out=${String(c.output).padStart(5)} (cap ${c.maxTokens}) cacheRead=${c.cacheRead} cacheWrite=${c.cacheWrite} ${c.ms}ms stop=${c.stop}`);
  }
}

/** Claims about the candidate: titles, rewrite wording and keywords to add. Explanations describe the role, so they are checked separately. */
function claimTexts(r: Awaited<ReturnType<typeof analyse>>["result"]): { field: string; text: string }[] {
  return [
    ...r.strengths.map((s, i) => ({ field: `strength[${i}].title`, text: s.title })),
    ...r.rewrites.flatMap((w, i) => [{ field: `rewrite[${i}].lightTouch`, text: w.lightTouch }, { field: `rewrite[${i}].strongerImpact`, text: w.strongerImpact }]),
    ...r.achievements.emphasise.map((e, i) => ({ field: `emphasise[${i}].title`, text: e.title })),
  ];
}
/** Explanations ("why it matters", "reason"): only named tools and qualifications are forbidden here. */
function explanationTexts(r: Awaited<ReturnType<typeof analyse>>["result"]): { field: string; text: string }[] {
  return [
    ...r.strengths.map((s, i) => ({ field: `strength[${i}].whyItMatters`, text: s.whyItMatters })),
    ...r.achievements.emphasise.map((e, i) => ({ field: `emphasise[${i}].reason`, text: e.reason })),
  ];
}
function allModelText(r: Awaited<ReturnType<typeof analyse>>["result"]): string[] {
  return [
    ...claimTexts(r).map((x) => x.text),
    ...explanationTexts(r).map((x) => x.text),
    ...r.rewrites.map((w) => w.whatChanged),
    ...Object.values(r.scores).flatMap((s) => (typeof s === "object" ? [s.reason] : [])),
    ...r.gaps.flatMap((g) => [g.requirement, g.whatCvShows, g.howToHandle]),
    ...r.rewrites.flatMap((w) => w.questionsForMe),
    ...r.achievements.quantify.map((q) => q.metricToLookFor),
  ];
}

async function runPair(p: Pair & { name: string }, withLetter: boolean) {
  console.log(`\n=== ${p.name}`);
  const client = countingClient();
  const start = log.length;
  const out = await analyse(p.cv, p.jd, client);
  const r = out.result;
  const mine = log.slice(start);
  printCalls(start);

  const expectedCalls = r.rewrites.length > 0 || r.keywords.addTruthfully.length > 0 || out.factCheckUsage ? 2 : 1;
  check(`one analysis call and ${expectedCalls - 1} fact-check call`, mine.length === expectedCalls && mine[0].tool === "submit_analysis");
  check("analysis on the main model, fact-check on the fast model", mine[0].model === mainModel() && (mine.length < 2 || mine[1].model === fastModel()));
  check("an overall score was computed in code", typeof r.scores.overall === "number");

  const quotes = [...r.strengths.map((s) => s.evidenceQuote), ...r.achievements.emphasise.map((e) => e.evidenceQuote), ...r.keywords.addTruthfully.map((a) => a.evidenceQuote), ...r.gaps.map((g) => g.evidenceQuote).filter(Boolean)];
  check(`every evidence quote exists in the CV (${quotes.length})`, quotes.every((q) => quoteIn(p.cv, q)));
  const badNumbers = r.rewrites.flatMap((w) => [...invalidNumbers(w.original, w.lightTouch), ...invalidNumbers(w.original, w.strongerImpact)]);
  check("no invented numbers in any rewrite", badNumbers.length === 0, badNumbers.join(", "));
  const named = [...new Set([...p.absent, ...jdOnlyTerms(p.jd, p.cv)])];
  const blocked = [...new Set([...named, ...r.keywords.gaps])];
  const leaks = claimTexts(r).flatMap((x) => blocked.filter((t) => !containsTerm(p.cv, t) && containsTerm(x.text, t)).map((t) => `"${t}" in ${x.field}: ${x.text.slice(0, 90)}`));
  check("skills the CV lacks never appear in titles, rewrite wording, achievement titles or keywords to add", leaks.length === 0, leaks.join(" | "));
  // Keywords to add have been through the evidence check and the fact-check. A generic gap word inside a longer
  // phrase ("reporting" in "performance reporting") is the model's own overlap, so only named tools are checked here.
  const addLeaks = r.keywords.addTruthfully.flatMap((a) => named.filter((t) => !containsTerm(p.cv, t) && containsTerm(a.keyword, t)).map((t) => `"${t}" in keyword to add: ${a.keyword}`));
  check("no named tool or qualification the CV lacks is offered as a keyword to add", addLeaks.length === 0, addLeaks.join(" | "));
  const proseLeaks = explanationTexts(r).flatMap((x) => named.filter((t) => !containsTerm(p.cv, t) && containsTerm(x.text, t)).map((t) => `"${t}" in ${x.field}: ${x.text.slice(0, 90)}`));
  check("named tools and qualifications the CV lacks never appear in explanations either", proseLeaks.length === 0, proseLeaks.join(" | "));
  check("every term the job asks for that the CV lacks is listed as a gap or absent from claims", p.absent.every((t) => r.keywords.gaps.some((g) => g.toLowerCase() === t.toLowerCase()) || !claimTexts(r).some((x) => containsTerm(x.text, t))));
  const us = allModelText(r).filter((t) => US_WORDS.test(t));
  check("all model-written text is in UK English", us.length === 0, us.slice(0, 2).join(" | "));
  check("rewrites are capped (at most 10)", r.rewrites.length <= 10);

  // Voice and style
  check("a voice description was read from the CV", !!r.voice && r.voice.description.length > 10);
  check("every favourite verb is really in the CV", (r.voice?.favouriteVerbs ?? []).every((v) => containsStem(p.cv, v)), (r.voice?.favouriteVerbs ?? []).join(", "));
  const tellNotes = r.rewrites.flatMap((w) => (w.styleNotes ?? []).filter((n) => /^Uses "|em dash/.test(n)).map((n) => `${w.sourceBulletId}: ${n}`));
  check("no rewrite uses machine-sounding words or em dashes", tellNotes.length === 0, tellNotes.join(" | "));
  const otherNotes = r.rewrites.flatMap((w) => (w.styleNotes ?? []).filter((n) => !/^Uses "|em dash/.test(n)).map((n) => `${w.sourceBulletId}: ${n}`));
  if (otherNotes.length > 0) console.log(`        rewrite style notes: ${otherNotes.join(" | ")}`);
  console.log(`        voice read as: ${r.voice?.description ?? "missing"} | verbs: ${(r.voice?.favouriteVerbs ?? []).join(", ")}`);

  // Summary and skills sections
  const cvBullets = splitCv(p.cv).bullets;
  const hasSummary = cvBullets.some((b) => sectionKind(b.section) === "summary");
  const summaryRewrite = r.rewrites.find((w) => w.kind === "summary");
  if (hasSummary) check("the summary paragraph gets a rewrite", !!summaryRewrite);
  check("no skills line is ever rewritten", !r.rewrites.some((w) => sectionKind(cvBullets.find((b) => b.id === w.sourceBulletId)?.section ?? "") === "skills"));
  const skillsText = cvBullets.filter((b) => sectionKind(b.section) === "skills").map((b) => b.text).join("\n");
  const front = r.keywords.skillsToFront ?? [];
  check(`skills to the front are all written in the CV's skills section (${front.length})`, front.every((k) => containsTerm(skillsText, k)), front.join(", "));
  if (p.crossIndustry) {
    const ci = p.crossIndustry;
    check("the role context names the job's sector", !!r.roleContext && /retail|e-?commerce|online/i.test(r.roleContext.industry), r.roleContext?.industry ?? "missing");
    const claimed = r.rewrites.flatMap((w) => ci.targetSectorTerms.filter((t) => !containsTerm(p.cv, t) && (containsTerm(w.lightTouch, t) || containsTerm(w.strongerImpact, t))).map((t) => `"${t}" in ${w.sourceBulletId}`));
    check("no rewrite claims experience in the target sector (retail, e-commerce)", claimed.length === 0, claimed.join(", "));
    if (summaryRewrite) {
      const kept = ci.cvSectorTerms.filter((t) => containsTerm(summaryRewrite.strongerImpact, t));
      check("the stronger summary restates the old sector's jargon neutrally", kept.length === 0, kept.join(", "));
    }
    console.log(`        role read as: ${r.roleContext?.industry} | ${r.roleContext?.seniority} | ${(r.roleContext?.priorities ?? []).join("; ")}`);
    for (const w of r.rewrites.slice(0, 4)) console.log(`        [${w.sourceBulletId}${w.kind === "summary" ? " summary" : ""}] ${w.verification} :: ${w.strongerImpact}`);
  }
  if (summaryRewrite) {
    const addedNames = [...jdOnlyTerms(summaryRewrite.lightTouch, summaryRewrite.original), ...jdOnlyTerms(summaryRewrite.strongerImpact, summaryRewrite.original)];
    check("the summary rewrite adds no new numbers or names", addedNames.length === 0 && invalidNumbers(summaryRewrite.original, summaryRewrite.lightTouch).length === 0 && invalidNumbers(summaryRewrite.original, summaryRewrite.strongerImpact).length === 0, addedNames.join(", "));
  }

  const amber = r.rewrites.filter((w) => w.verification !== "supported").length;
  console.log(`        rewrites: ${r.rewrites.length} (${amber} flagged amber), dropped by code: ${JSON.stringify(out.dropped)}`);
  console.log(`        gaps: ${r.keywords.gaps.join(", ") || "none"} | to add: ${r.keywords.addTruthfully.map((a) => a.keyword).join(", ") || "none"}`);
  r.rewrites.forEach((w, i) => {
    if (w.verification !== "supported") console.log(`        amber rewrite[${i}] (${w.sourceBulletId}): ${w.issues.join(" || ")}`);
  });

  // Tokens: anything larger than it needs to be
  const a = mine[0];
  if (a.output > a.maxTokens * 0.75) notes.push(`${p.name}: analysis output used ${a.output} of ${a.maxTokens} tokens (over 75% of the cap). Consider trimming fields.`);
  // Count cached tokens too: "input" alone excludes what was read from or written to the cache.
  const totalIn = (c: CallLog) => c.input + c.cacheRead + c.cacheWrite;
  if (mine[1] && totalIn(mine[1]) > totalIn(a) * 0.8) notes.push(`${p.name}: the fact-check received ${totalIn(mine[1])} input tokens in total, close to the analysis call's ${totalIn(a)}. It may be sending more than needed.`);
  if (mine[1] && mine[1].output > mine[1].maxTokens * 0.75) notes.push(`${p.name}: fact-check output used ${mine[1].output} of ${mine[1].maxTokens} tokens.`);
  if (mine.some((c) => c.stop === "max_tokens")) notes.push(`${p.name}: a call hit its max_tokens cap and was cut off.`);

  if (withLetter) {
    const s2 = log.length;
    const accepted = r.rewrites.slice(0, 2).map((w) => ({ id: w.sourceBulletId, text: w.lightTouch }));
    const letter = await generateLetter({ cv: p.cv, jd: p.jd, accepted, gapKeywords: r.keywords.gaps, voice: r.voice }, client);
    printCalls(s2);
    const lcalls = log.slice(s2);
    check("cover letter: one letter call and at most one fact-check call", lcalls.length >= 1 && lcalls.length <= 2 && lcalls[0].tool === "submit_letter");
    check(`cover letter length is 250 to 300 words (got ${letter.wordCount})`, letter.wordCount >= 250 && letter.wordCount <= 300);
    const hard = letter.styleNotes.filter((n) => /^Uses "|em dash|Repeats the phrase/.test(n));
    check("cover letter has no machine-sounding words, em dashes or repeated stock phrases", hard.length === 0, hard.join(" | "));
    const soft = letter.styleNotes.filter((n) => !hard.includes(n) && !/words\. The aim/.test(n));
    if (soft.length > 0) console.log(`        letter style notes: ${soft.join(" | ")}`);
    check("cover letter is in UK English with no clichés or banned opener", !US_WORDS.test(letter.letter) && letter.styleNotes.every((n) => !/opener|passionate|dynamic|results|US spelling/.test(n)));
    const lleak = named.filter((t) => !containsTerm(p.cv, t) && containsTerm(letter.letter, t));
    check("cover letter never mentions a tool or qualification the CV lacks", lleak.length === 0, lleak.join(", "));
    const lclaims = checkLetter(letter.letter, [p.cv, ...accepted.map((a) => a.text)].join("\n"), r.keywords.gaps, named).factIssues;
    check("cover letter makes no claim about a skill the CV lacks (echoing the employer's wording is fine)", lclaims.length === 0, lclaims.join(" | "));
    check("cover letter passes verification (green)", letter.verification === "supported", letter.issues.join(" | "));
    console.log(`\n--- letter (${letter.wordCount} words) ---\n${letter.letter}\n---`);
  }
  return { out, mine };
}

async function compareFactCheck() {
  console.log("\n=== Fact-check comparison: fast model vs main model on planted rewrites");
  const client = countingClient();
  const { bullets } = splitCv(PAIRS[0].cv);
  const idOf = (start: string) => bullets.find((b) => b.text.startsWith(start))?.id ?? "";

  // Each planted rewrite gets its own bullet ID so verdicts can be read per item.
  // Good and bad rewrites of the same bullet are sent as separate items, so give each a unique key.
  const rewrites: (Rewrite & { truth: boolean; why: string })[] = PLANTED.map((p, i) => {
    const id = idOf(p.startsWith);
    const original = bullets.find((b) => b.id === id)!.text;
    return { sourceBulletId: `${id}#${i + 1}`, original, lightTouch: p.light, strongerImpact: p.stronger, whatChanged: "", placeholders: [], questionsForMe: [], verification: "pending", issues: [], truth: p.supported, why: p.why };
  });
  const claims: (KeywordClaim & { truth: boolean; why: string })[] = PLANTED_KEYWORDS.map((k) => {
    const b = bullets.find((x) => x.text.startsWith(k.startsWith))!;
    return { keyword: k.keyword, sourceBulletId: b.id, evidenceQuote: b.text, truth: k.supported, why: k.why };
  });

  const results: Record<string, { rewrites: Map<string, boolean>; keywords: Map<string, boolean> }> = {};
  for (const [label, model] of [["fast", fastModel()], ["main", mainModel()]] as const) {
    const s = log.length;
    const res = await factCheck(client, rewrites, bullets, model, claims);
    printCalls(s);
    results[label] = {
      rewrites: new Map(res.rewrites.map((w) => [w.sourceBulletId, w.verification === "supported"])),
      keywords: new Map(claims.map((c) => [c.keyword, res.keywordVerdicts?.get(c.keyword.toLowerCase()) === true])),
    };
  }

  const score = (label: string) => {
    const r = results[label];
    const bad = rewrites.filter((w) => !w.truth);
    const good = rewrites.filter((w) => w.truth);
    const caught = bad.filter((w) => r.rewrites.get(w.sourceBulletId) === false);
    const falseFlags = good.filter((w) => r.rewrites.get(w.sourceBulletId) === false);
    const badK = claims.filter((c) => !c.truth);
    const goodK = claims.filter((c) => c.truth);
    const caughtK = badK.filter((c) => r.keywords.get(c.keyword) === false);
    const falseK = goodK.filter((c) => r.keywords.get(c.keyword) === false);
    return { caught, bad, falseFlags, good, caughtK, badK, falseK, goodK };
  };

  for (const label of ["fast", "main"] as const) {
    const s = score(label);
    console.log(`\n  ${label} model (${label === "fast" ? fastModel() : mainModel()}):`);
    console.log(`    unsupported rewrites caught: ${s.caught.length} of ${s.bad.length}; good rewrites wrongly flagged: ${s.falseFlags.length} of ${s.good.length}`);
    console.log(`    unsupported keywords caught: ${s.caughtK.length} of ${s.badK.length}; good keywords wrongly rejected: ${s.falseK.length} of ${s.goodK.length}`);
    for (const w of s.bad.filter((w) => !s.caught.includes(w))) console.log(`    MISSED: ${w.why}`);
    for (const c of s.badK.filter((c) => !s.caughtK.includes(c))) console.log(`    MISSED keyword "${c.keyword}": ${c.why}`);
  }

  const f = score("fast");
  const m = score("main");
  const missedByFast = f.bad.length - f.caught.length + (f.badK.length - f.caughtK.length);
  const missedByMain = m.bad.length - m.caught.length + (m.badK.length - m.caughtK.length);
  console.log("\n  Verdict:");
  if (missedByFast > missedByMain) {
    console.log(`  The fast model missed ${missedByFast} unsupported claim(s) that the main model caught or ${missedByFast - missedByMain} more than it. Suggest setting ANTHROPIC_FAST_MODEL=${mainModel()} in .env.local.`);
    notes.push("The fast model missed unsupported claims the main model caught: consider changing ANTHROPIC_FAST_MODEL to the main model.");
  } else if (missedByFast > 0) {
    console.log(`  Both models missed ${missedByFast} planted claim(s). Switching the fast model would not help; see the MISSED lines above.`);
    notes.push(`The fact-check (both models) missed ${missedByFast} planted unsupported claim(s). Read the amber and green tags as a guide, not a guarantee, and check the MISSED lines above.`);
  } else {
    console.log("  The fast model caught every planted unsupported claim. No change needed.");
  }
  if (f.falseFlags.length + f.falseK.length > m.falseFlags.length + m.falseK.length) {
    notes.push("The fast model wrongly flagged more good rewrites or keywords than the main model (more amber tags than needed).");
  }
}

async function main() {
  console.log(`Models: main=${mainModel()}  fast=${fastModel()}`);

  const results = [];
  for (const [i, p] of PAIRS.entries()) results.push(await runPair(p, i === 0 || i === 1 || i === 2));

  await runPair({ name: "RED TEAM: job description asks for tools the CV does not have (and contains an injected instruction)", cv: RED_TEAM.cv, jd: RED_TEAM.jd, absent: RED_TEAM.absent }, true);

  // Does prompt caching work? Run the first pair again straight away.
  console.log("\n=== Prompt caching check (pair 1 again, straight after)");
  const again = await runPair({ ...PAIRS[0], name: "1 (repeat)" }, false);
  const cacheRead = again.mine.reduce((n, c) => n + c.cacheRead, 0);
  console.log(`        total cacheRead on the repeat run: ${cacheRead}`);
  if (cacheRead === 0) notes.push("No cache reads on a repeat run: the static prompts are probably below the minimum cacheable length for these models, so caching saves nothing. Harmless.");

  await compareFactCheck();

  const totals = log.reduce((t, c) => ({ input: t.input + c.input, output: t.output + c.output, calls: t.calls + 1 }), { input: 0, output: 0, calls: 0 });
  console.log(`\n=== Totals: ${totals.calls} API calls, ${totals.input.toLocaleString("en-GB")} input tokens, ${totals.output.toLocaleString("en-GB")} output tokens`);
  void results;

  if (notes.length) {
    console.log("\nThings to look at:");
    notes.forEach((n) => console.log("  - " + n));
  }
  if (failures) {
    console.log(`\n${failures} check(s) FAILED. Do not rely on the app until these are understood.`);
    process.exit(1);
  }
  console.log("\nAll live checks passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
