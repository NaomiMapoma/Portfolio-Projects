// Offline checks for the analysis engine and rewrite checks. No API calls: a
// fake client stands in. Run: npx tsx scripts/test-analysis.ts

import { jsonReply, kindOf } from "./test-utils";
import { AnalysisError, MAX_CV_CHARS, MAX_JD_CHARS, analyse, type MessagesClient } from "../lib/claude";
import { formatForPrompt, quoteIn, sectionKind, splitCv } from "../lib/bullets";
import { containsTerm, partitionKeywords, validateAchievements } from "../lib/keywords";
import { buildRewrites, invalidNumbers } from "../lib/rewrites";
import { computeOverall } from "../lib/types";

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
// Bullets: B1 Jane Sample (top), B2 Programme Manager..., B3 Led delivery, B4 Presented, B5 Managed, B6 Stakeholder...

const goodBase = {
  scores: {
    roleMatch: { score: 70, reason: "Good match." },
    impact: { score: 50, reason: "Few outcomes." },
    keywords: { score: 60, reason: "Some terms." },
    clarity: { score: 80, reason: "Clear." },
  },
  strengths: [
    {
      title: "Delivery",
      whyItMatters: "Role is delivery focused.",
      sourceBulletId: "B3",
      evidenceQuote: "Led delivery of a customer portal migration",
    },
    {
      title: "Invented skill",
      whyItMatters: "Made up.",
      sourceBulletId: "B3",
      evidenceQuote: "Managed a 50 million pound budget", // not in the CV: must be dropped
    },
  ],
  gaps: [
    {
      requirement: "Budget ownership",
      severity: "high",
      whatCvShows: "Nothing about budgets.",
      howToHandle: "Accept as a gap.",
      sourceBulletId: "",
      evidenceQuote: "",
    },
    {
      requirement: "Jira",
      severity: "low",
      whatCvShows: "Agile only.",
      howToHandle: "Only add if true.",
      sourceBulletId: "B9",
      evidenceQuote: "Used Jira daily", // bad evidence: should be cleared, gap kept
    },
  ],
};
const good = { ...goodBase, rewrites: [] };

const draft = (id: string, light: string, stronger: string) => ({
  sourceBulletId: id,
  lightTouch: light,
  strongerImpact: stronger,
  whatChanged: "Clearer outcome.",
  placeholders: ["[X%]"],
  questionsForMe: ["What was the real figure?"],
});

const rewriteGood = draft(
  "B3",
  "Led the customer portal migration across three teams.",
  "Led a three-team customer portal migration that [outcome, e.g. cut support contacts by X%].",
);
const rewriteGood2 = draft(
  "B5",
  "Managed a team of 6 analysts and cut reporting time by 20%.",
  "Managed 6 analysts and cut reporting time by 20% through [what you changed].",
);
const rewriteInvented = draft(
  "B4",
  "Presented fortnightly progress updates to the steering group.",
  "Presented fortnightly updates to a 12-person steering group, improving decisions by 40%.", // 12 and 40 are invented
);

const usageOf = (i: number, o: number) => ({
  input_tokens: i,
  output_tokens: o,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
});

type Call = { params: Record<string, unknown> };
type Script = { analysis: unknown[]; verdicts?: unknown[] | "throw" };

/** Fake client: answers the analysis tool and the verdict tool separately. */
function fakeClient(script: Script): { client: MessagesClient; analysisCalls: Call[]; factCalls: Call[] } {
  const analysisCalls: Call[] = [];
  const factCalls: Call[] = [];
  let a = 0;
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        const tool = kindOf(params);
        if (tool === "submit_verdicts") {
          factCalls.push({ params });
          if (script.verdicts === "throw") throw new Error("boom");
          const input = (script.verdicts ?? [])[Math.min(factCalls.length - 1, (script.verdicts ?? []).length - 1)];
          return jsonReply(input, usageOf(200, 80));
        }
        analysisCalls.push({ params });
        const input = script.analysis[Math.min(a++, script.analysis.length - 1)];
        return jsonReply(input, { ...usageOf(1000, 300), cache_creation_input_tokens: 800 });
      },
    },
  } as unknown as MessagesClient;
  return { client, analysisCalls, factCalls };
}

const allSupported = {
  verdicts: [
    { id: "B3", supported: true, unsupportedClaims: [] },
    { id: "B5", supported: true, unsupportedClaims: [] },
  ],
};

async function rejects(fn: () => Promise<unknown>): Promise<AnalysisError | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof AnalysisError ? e : null;
  }
}

async function main() {
  // ---------- Bullet splitting and quotes ----------
  const { bullets } = splitCv(CV);
  check("headings are not bullets", !bullets.some((b) => b.text === "EXPERIENCE" || b.text === "SKILLS"));
  check("list markers stripped", bullets.some((b) => b.text.startsWith("Led delivery")));
  check("ids are sequential", bullets.map((b) => b.id).join() === bullets.map((_, i) => `B${i + 1}`).join());
  check("prompt text has section and id", formatForPrompt(bullets).includes("## EXPERIENCE") && formatForPrompt(bullets).includes("B3:"));
  check("B3 is the delivery bullet", bullets.find((b) => b.id === "B3")?.text.startsWith("Led delivery") === true);
  check("quote matches despite case and spacing", quoteIn(CV, "led  DELIVERY of a customer portal"));
  check("fabricated quote does not match", !quoteIn(CV, "Managed a 50 million pound budget"));
  check("empty quote never matches", !quoteIn(CV, ""));

  // ---------- Number check ----------
  const orig = "Managed a team of 6 analysts and cut reporting time by 20% in 2023, saving 1,000 hours";
  check("numbers already in the original are allowed", invalidNumbers(orig, "Managed 6 analysts, cutting time by 20% in 2023").length === 0);
  check("comma-normalised numbers match", invalidNumbers(orig, "Saved 1000 hours").length === 0);
  check("invented number is rejected", invalidNumbers(orig, "Cut reporting time by 40%").join() === "40");
  check("digits inside a placeholder are allowed", invalidNumbers(orig, "Cut time by [25%] across [3 teams]").length === 0);
  check("a placeholder does not excuse a number outside it", invalidNumbers(orig, "Cut time by 40% to [X%]").join() === "40");
  check("no numbers means nothing to reject", invalidNumbers("Led a team", "Led the team and improved results").length === 0);

  // ---------- Overall score ----------
  const s = goodBase.scores;
  check("overall = 40/25/20/15", computeOverall(s) === Math.round(70 * 0.4 + 50 * 0.25 + 60 * 0.2 + 80 * 0.15));

  // ---------- Engine, no rewrites ----------
  {
    const { client, analysisCalls, factCalls } = fakeClient({ analysis: [good] });
    const out = await analyse(CV, "Job description text", client);
    check("one analysis call on success", analysisCalls.length === 1);
    check("no fact-check call when there are no rewrites", factCalls.length === 0);
    check("overall added by code", out.result.scores.overall === computeOverall(s));
    check("fabricated strength dropped", out.result.strengths.length === 1 && out.dropped.strengths === 1);
    check("bad gap evidence cleared, gap kept", out.result.gaps.length === 2 && out.dropped.gapEvidenceCleared === 1);
    check("token usage returned", out.usage.input === 1000 && out.usage.output === 300);

    const p = analysisCalls[0].params as {
      model: string;
      max_tokens: number;
      system: { cache_control?: unknown; text: string }[];
      messages: { content: string }[];
      output_config: { format: { type: string } };
      thinking?: unknown;
    };
    check("model has a value from env or default", typeof p.model === "string" && p.model.length > 0);
    check("max_tokens is capped", p.max_tokens > 0 && p.max_tokens <= 8000);
    check("system block is cached", !!p.system[0].cache_control);
    check("CV and JD are not in the cached system prompt", !p.system[0].text.includes("Led delivery") && !p.system[0].text.includes("Job description text"));
    check("CV and JD are in the user message", p.messages[0].content.includes("Led delivery") && p.messages[0].content.includes("Job description text"));
    check("structured JSON output is requested (Sonnet 5.5 cannot force a tool call)", p.output_config.format.type === "json_schema" && !("tool_choice" in p) && !("tools" in p));
    check("extended thinking is switched off", (p.thinking as { type: string } | undefined)?.type === "disabled");
  }

  // ---------- Engine with rewrites and the fact-check ----------
  {
    process.env.ANTHROPIC_FAST_MODEL = "fast-model-from-env";
    const { client, analysisCalls, factCalls } = fakeClient({
      analysis: [{ ...goodBase, rewrites: [rewriteGood, rewriteGood2, rewriteInvented] }],
      verdicts: [allSupported],
    });
    const out = await analyse(CV, "jd", client);
    const rw = out.result.rewrites;

    check("exactly one fact-check request for several rewrites", factCalls.length === 1);
    check("exactly two API calls in a full run", analysisCalls.length + factCalls.length === 2);
    check("invented number rewrite removed and counted", rw.length === 2 && out.dropped.rewritesRejected === 1);
    check("placeholder rewrite kept", rw.some((r) => r.sourceBulletId === "B3" && r.strongerImpact.includes("[outcome")));
    check("original comes from the CV bullet, not the model", rw[0].original === bullets.find((b) => b.id === "B3")!.text);
    check("supported verdict gives supported status", rw.every((r) => r.verification === "supported" && r.issues.length === 0));

    const f = factCalls[0].params as {
      model: string;
      max_tokens: number;
      output_config: { format: { type: string } };
      messages: { content: string }[];
      system: { cache_control?: unknown }[];
    };
    const sent = f.messages[0].content;
    check("fast model name comes from the environment", f.model === "fast-model-from-env");
    check("fact-check output is capped", f.max_tokens > 0 && f.max_tokens <= 2000);
    check("fact-check asks for structured JSON output", f.output_config.format.type === "json_schema");
    check("fact-check sends the rewrites with their originals", sent.includes("ORIGINAL: Led delivery of a customer portal") && sent.includes("ORIGINAL: Managed a team of 6"));
    check("fact-check sends the whole CV as numbered bullets", sent.includes("B6: Stakeholder management") && sent.includes("B4: Presented fortnightly") && sent.includes("## EXPERIENCE"));
    check("fact-check does not send the job description", !sent.includes("Job description"));
    check("rejected rewrite text is never sent to the fact-check", !sent.includes("improving decisions by 40%") && !sent.includes("12-person"));
    const fsys = (f.system as unknown as { text: string }[])[0].text;
    check("fact-check system prompt is cached and has no CV text", !!f.system[0].cache_control && !fsys.includes("Led delivery") && !fsys.includes("Stakeholder management"));
    check("fact-check prompt allows same-role support and flags borrowed facts", /same role/i.test(fsys) && /different role/i.test(fsys));
    check("fact-check usage is added to the total", out.usage.input === 1200 && out.usage.output === 380 && out.factCheckUsage?.input === 200);
    delete process.env.ANTHROPIC_FAST_MODEL;

    const d = fakeClient({ analysis: [{ ...goodBase, rewrites: [rewriteGood] }], verdicts: [{ verdicts: [] }] });
    await analyse(CV, "jd", d.client);
    check("default fast model used when the variable is unset", (d.factCalls[0].params as { model: string }).model === "claude-sonnet-5-5");
  }

  // ---------- Unsupported claim becomes amber ----------
  {
    const { client } = fakeClient({
      analysis: [{ ...goodBase, rewrites: [rewriteGood, rewriteGood2] }],
      verdicts: [
        {
          verdicts: [
            { id: "B3", supported: false, unsupportedClaims: ["Claims the migration cut support contacts"] },
            { id: "B5", supported: true, unsupportedClaims: [] },
          ],
        },
      ],
    });
    const out = await analyse(CV, "jd", client);
    const b3 = out.result.rewrites.find((r) => r.sourceBulletId === "B3")!;
    const b5 = out.result.rewrites.find((r) => r.sourceBulletId === "B5")!;
    check("unsupported claim gives 'check' with the claim named", b3.verification === "check" && b3.issues[0].includes("support contacts"));
    check("other rewrite stays supported", b5.verification === "supported");
  }

  // ---------- Missing verdict, bad output, API failure: fail safe, no retry ----------
  {
    const missing = fakeClient({
      analysis: [{ ...goodBase, rewrites: [rewriteGood, rewriteGood2] }],
      verdicts: [{ verdicts: [{ id: "B3", supported: true, unsupportedClaims: [] }] }],
    });
    const m = await analyse(CV, "jd", missing.client);
    check("rewrite missing from the verdicts is marked 'check'", m.result.rewrites.find((r) => r.sourceBulletId === "B5")?.verification === "check");

    const invalid = fakeClient({ analysis: [{ ...goodBase, rewrites: [rewriteGood] }], verdicts: [{ nonsense: true }] });
    const i = await analyse(CV, "jd", invalid.client);
    check("invalid fact-check output marks all 'check' with one request only", invalid.factCalls.length === 1 && i.result.rewrites.every((r) => r.verification === "check"));

    const thrown = fakeClient({ analysis: [{ ...goodBase, rewrites: [rewriteGood] }], verdicts: "throw" });
    const t = await analyse(CV, "jd", thrown.client);
    check("fact-check API failure marks all 'check', no retry", thrown.factCalls.length === 1 && t.result.rewrites.every((r) => r.verification === "check" && r.issues.length > 0));
  }

  // ---------- All rewrites rejected: no fact-check call ----------
  {
    const { client, factCalls } = fakeClient({ analysis: [{ ...goodBase, rewrites: [rewriteInvented, draft("B99", "x", "y")] }] });
    const out = await analyse(CV, "jd", client);
    check("no fact-check call when every rewrite is rejected", factCalls.length === 0 && out.result.rewrites.length === 0 && out.dropped.rewritesRejected === 2);
  }

  // ---------- Summary and skills sections ----------
  {
    const CV3 = `Casey Sample

PROFILE
Performance marketer with 8 years of experience managing paid social campaigns for financial brands including AMEX.

EXPERIENCE
- Managed £5M annual media spend across paid social

SKILLS
Paid Media: Meta Ads Manager, TikTok Ads Manager
Reporting: GA4, Tableau`;
    // B1 Casey Sample, B2 profile paragraph, B3 experience bullet, B4 and B5 skills lines.
    const summaryGood = draft(
      "B2",
      "Performance marketer with 8 years of experience running paid social campaigns for financial brands including AMEX.",
      "Performance marketer with 8 years of experience running paid social for financial brands including AMEX.",
    );
    const summaryAddsRegulator = draft(
      "B2",
      "Performance marketer with 8 years of experience in paid social for financial brands, regulated by the FCA.",
      "Performance marketer with 8 years of experience in paid social for financial brands including AMEX.",
    );
    const skillsRewrite = draft("B4", "Paid Media: Meta Ads Manager, TikTok Ads Manager, Snapchat Ads", "Paid Media: Meta Ads Manager, TikTok Ads Manager, Snapchat Ads");
    const verdicts = { verdicts: [{ id: "B2", supported: true, unsupportedClaims: [] }] };

    const ok = await analyse(
      CV3,
      "jd",
      fakeClient({
        analysis: [
          {
            ...goodBase,
            rewrites: [summaryGood, skillsRewrite],
            keywords: { present: [], addTruthfully: [], gaps: ["Snapchat Ads"], skillsToFront: ["Meta Ads Manager", "tableau", "Snapchat Ads", "Reddit Ads", "Meta Ads Manager"] },
          },
        ],
        verdicts: [verdicts],
      }).client,
    );
    check("summary paragraph rewrite is kept and marked as the summary", ok.result.rewrites.length === 1 && ok.result.rewrites[0].sourceBulletId === "B2" && ok.result.rewrites[0].kind === "summary");
    check("a rewrite of a skills line is rejected", !ok.result.rewrites.some((r) => r.sourceBulletId === "B4") && ok.dropped.rewritesRejected === 1);
    check(
      "skills to the front: only skills literally in the skills section, no gaps, no duplicates",
      JSON.stringify(ok.result.keywords.skillsToFront) === JSON.stringify(["Meta Ads Manager", "tableau"]),
    );

    const bad = await analyse(
      CV3,
      "jd",
      fakeClient({ analysis: [{ ...goodBase, rewrites: [summaryAddsRegulator] }], verdicts: [verdicts] }).client,
    );
    check("a summary rewrite that adds a name the paragraph does not contain (FCA) is rejected", bad.result.rewrites.length === 0 && bad.dropped.rewritesRejected === 1);
    // Tailoring: a neutral, still-true restatement is kept; a reframe that brings in a new name is rejected.
    const reframed = draft(
      "B2",
      "Performance marketer with 8 years of experience running paid social campaigns for regulated brands including AMEX.",
      "Performance marketer with 8 years of experience running paid social in regulated environments, including for AMEX.",
    );
    const reframedWithName = draft(
      "B2",
      "Performance marketer with 8 years of experience running paid social campaigns, now bringing Shopify retail know-how.",
      "Performance marketer with 8 years of experience running paid social campaigns for retail brands including AMEX.",
    );
    const roleContext = { roleIndustry: "retail e-commerce", roleSeniority: "senior individual contributor", rolePriorities: "experimentation; creative testing; budget ownership" };
    const tailored = await analyse(CV3, "jd", fakeClient({ analysis: [{ ...goodBase, rewrites: [reframed], ...roleContext }], verdicts: [verdicts] }).client);
    check("a neutral restatement for a different sector is kept as the summary rewrite", tailored.result.rewrites.length === 1 && tailored.result.rewrites[0].kind === "summary");
    check("the role context is passed through to the result", tailored.result.roleContext?.industry === "retail e-commerce" && tailored.result.roleContext.priorities.length === 3);
    const named = await analyse(CV3, "jd", fakeClient({ analysis: [{ ...goodBase, rewrites: [reframedWithName] }], verdicts: [verdicts] }).client);
    check("a reframe that brings in a new name (Shopify) is rejected", named.result.rewrites.length === 0 && named.dropped.rewritesRejected === 1);
    const sysCall = fakeClient({ analysis: [{ ...goodBase, rewrites: [] }], verdicts: [verdicts] });
    await analyse(CV3, "jd", sysCall.client);
    const sysText = JSON.stringify(sysCall.analysisCalls[0].params.system);
    check("the cached prompt asks for role context and tailoring, and forbids claiming the target industry", /roleIndustry/.test(sysText) && /Tailoring/.test(sysText) && /Never claim experience in the target industry/.test(sysText));
    check("the analysis result without role context still works", ok.result.roleContext === undefined);
    check("section kinds are recognised", sectionKind("PERSONAL SUMMARY") === "summary" && sectionKind("Profile") === "summary" && sectionKind("TECHNICAL SKILLS") === "skills" && sectionKind("EXPERIENCE") === "other");
  }

  // ---------- Keywords (Step 7) ----------
  {
    check("containsTerm is whole-word and case-insensitive", containsTerm("Used JavaScript daily", "javascript") && !containsTerm("Used JavaScript daily", "Java"));

    const kw = partitionKeywords(
      {
        present: ["agile delivery", "Kubernetes", "agile delivery"], // Kubernetes is not in the CV; duplicate
        addTruthfully: [
          { keyword: "programme management", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration", suggestedSection: "summary" },
          { keyword: "PRINCE2", sourceBulletId: "B3", evidenceQuote: "Certified PRINCE2 practitioner", suggestedSection: "skills" }, // bad quote
          { keyword: "Stakeholder management", sourceBulletId: "B6", evidenceQuote: "Stakeholder management", suggestedSection: "skills" }, // literally in the CV
        ],
        gaps: ["Jira", "reporting"], // "reporting" is literally in the CV
        skillsToFront: [],
      },
      CV,
      bullets,
    );
    const k = kw.keywords;
    check("valid add-truthfully keyword is kept with its evidence", k.addTruthfully.length === 1 && k.addTruthfully[0].keyword === "programme management" && k.addTruthfully[0].evidenceQuote.length > 0);
    check("add-truthfully with a fake quote is demoted to gaps", !k.addTruthfully.some((a) => a.keyword === "PRINCE2") && k.gaps.includes("PRINCE2"));
    check("'present' keyword not in the CV is demoted to gaps", !k.present.includes("Kubernetes") && k.gaps.includes("Kubernetes"));
    check("keyword literally in the CV is shown as present", k.present.includes("Stakeholder management") && k.present.includes("reporting"));
    check("keywords are de-duplicated", k.present.filter((p) => p.toLowerCase() === "agile delivery").length === 1);
    check("genuine gap stays a gap", k.gaps.includes("Jira") && !k.present.includes("Jira"));
    check("demoted count is reported", kw.demoted === 2);

    // Plain lowercase single words may match a different ending; names, phrases and look-alikes stay exact.
    const kw2 = partitionKeywords(
      { present: ["present", "java", "customer migration", "PRESENT"], addTruthfully: [], gaps: ["team", "teams", "Jira"], skillsToFront: [] },
      CV,
      bullets,
    ).keywords;
    check("single plain word matches a different ending ('present' vs 'Presented')", kw2.present.includes("present") && !kw2.gaps.includes("present"));
    check("stem matching does not make 'java' match JavaScript-like words or absent words", kw2.gaps.includes("java") && !kw2.present.includes("java"));
    check("multi-word phrase with words missing in between stays a gap", kw2.gaps.includes("customer migration") && !kw2.present.includes("customer migration"));
    check("a gap word with a different ending in the CV ('team' vs 'teams') becomes present", kw2.present.includes("team") && kw2.present.includes("teams"));
    check("a name absent from the CV stays a gap", kw2.gaps.includes("Jira"));

    const ach = validateAchievements(
      {
        emphasise: [
          { title: "Portal", reason: "Matches role.", sourceBulletId: "B3", evidenceQuote: "customer portal migration" },
          { title: "Fake", reason: "Made up.", sourceBulletId: "B3", evidenceQuote: "Won an industry award" },
          { title: "Team", reason: "Leadership.", sourceBulletId: "B5", evidenceQuote: "Managed a team of 6 analysts" },
        ],
        quantify: [
          { sourceBulletId: "B4", metricToLookFor: "How many people attended the steering group?" },
          { sourceBulletId: "B99", metricToLookFor: "Unknown bullet?" },
          { sourceBulletId: "B4", metricToLookFor: "Duplicate?" },
        ],
      },
      bullets,
    );
    check("emphasise item without a real quote is dropped, order kept", ach.achievements.emphasise.map((e) => e.title).join() === "Portal,Team");
    check("quantify bullet text is filled in by code", ach.achievements.quantify.length === 1 && ach.achievements.quantify[0].bullet.startsWith("Presented fortnightly"));
    check("unknown and duplicate quantify items dropped", ach.dropped === 1 + 2);

    // Gap keywords are never injected into rewrites
    const jiraDraft = draft("B4", "Presented fortnightly progress updates to the steering group using Jira.", "Presented fortnightly updates, tracked in jira.");
    const okDraft = draft("B3", "Led the customer portal migration across three teams.", "Led a three-team portal migration.");
    const built = buildRewrites([jiraDraft, okDraft], bullets, ["Jira"]);
    check("rewrite that introduces a gap keyword is rejected", built.rewrites.length === 1 && built.rewrites[0].sourceBulletId === "B3" && built.rejected === 1);
    const keepsTerm = buildRewrites([draft("B4", "Presented fortnightly updates to the steering group.", "Presented to the steering group fortnightly.")], bullets, ["steering group"]);
    check("a keyword already in the original bullet is not treated as injected", keepsTerm.rewrites.length === 1);

    // Whole run: still exactly two API calls
    const { client, analysisCalls, factCalls } = fakeClient({
      analysis: [
        {
          ...goodBase,
          rewrites: [jiraDraft, okDraft],
          achievements: {
            emphasise: [{ title: "Portal", reason: "Matches role.", sourceBulletId: "B3", evidenceQuote: "customer portal migration" }],
            quantify: [{ sourceBulletId: "B4", metricToLookFor: "How many people attended?" }],
          },
          keywords: {
            present: ["agile delivery"],
            addTruthfully: [{ keyword: "programme management", sourceBulletId: "B3", evidenceQuote: "Led delivery of a customer portal migration", suggestedSection: "summary" }],
            gaps: ["Jira"],
          },
        },
      ],
      verdicts: [{ verdicts: [{ id: "B3", supported: true, unsupportedClaims: [] }], keywordVerdicts: [{ keyword: "programme management", supported: true }] }],
    });
    const out = await analyse(CV, "jd", client);
    check("full run is still one analysis call and one fact-check call", analysisCalls.length === 1 && factCalls.length === 1);
    check("achievements and keywords are returned", out.result.achievements.emphasise.length === 1 && out.result.keywords.gaps.includes("Jira") && out.result.keywords.addTruthfully.length === 1);
    check("gap keyword rewrite removed in the full run and counted", out.result.rewrites.length === 1 && out.dropped.rewritesRejected === 1);
    check("rewrite with the gap keyword never reaches the fact-check", !(factCalls[0].params.messages as { content: string }[])[0].content.includes("using Jira"));
    check("dropped counts reported", out.dropped.achievementsDropped === 0 && out.dropped.keywordsDemoted === 0);
  }

  // ---------- Retry once on invalid analysis output, then stop ----------
  {
    const bad = fakeClient({ analysis: [{ nonsense: true }] });
    const e1 = await rejects(() => analyse(CV, "jd", bad.client));
    check("invalid analysis: exactly one retry then an error", bad.analysisCalls.length === 2 && e1?.status === 502);

    const recover = fakeClient({ analysis: [{ nonsense: true }, good] });
    const r2 = await analyse(CV, "jd", recover.client);
    check("retry can recover", recover.analysisCalls.length === 2 && r2.usage.input === 2000);
  }

  // ---------- Limits ----------
  {
    const never = fakeClient({ analysis: [good] });
    const e2 = await rejects(() => analyse("x".repeat(MAX_CV_CHARS + 1), "jd", never.client));
    const e3 = await rejects(() => analyse(CV, "x".repeat(MAX_JD_CHARS + 1), never.client));
    check("oversized CV rejected with 413", e2?.status === 413 && /shorten/i.test(e2.message));
    check("oversized job description rejected with 413", e3?.status === 413 && /shorten/i.test(e3.message));
    check("no API call for rejected input", never.analysisCalls.length === 0 && never.factCalls.length === 0);
  }

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
