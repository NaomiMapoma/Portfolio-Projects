// Offline checks for the style rules and style checks (no API calls).
// Run: npx tsx scripts/test-style.ts

import { styleNotes } from "../lib/style-checks";
import { AI_TELLS, STYLE_RULES } from "../lib/style";
import { generateLetter } from "../lib/letter";
import { analyse, type MessagesClient } from "../lib/claude";
import { jsonReply, kindOf } from "./test-utils";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

const has = (notes: string[], re: RegExp) => notes.some((n) => re.test(n));

async function main() {
  // ---------- The checker ----------
  check("plain human text has no notes", styleNotes("I ran the weekly stock count. It took two of us, and we usually finished before lunch.").length === 0);
  check("machine-sounding words are flagged", has(styleNotes("I leveraged a robust, seamless process."), /leverage/) && has(styleNotes("I leveraged a robust, seamless process."), /robust/) && has(styleNotes("I leveraged a robust, seamless process."), /seamless/));
  check("em dashes are flagged", has(styleNotes("I led the move — and it went well."), /em dash/i));
  check("a word the candidate used in their own CV is not flagged", styleNotes("I ran dynamic pricing reviews.", "Ran dynamic pricing reviews for the shop.").length === 0);
  check("the same word is flagged when the CV does not use it", has(styleNotes("I ran dynamic pricing reviews.", "Ran pricing reviews."), /dynamic/));
  check("three sentences opening the same way are flagged", has(styleNotes("I managed the rota. I managed the stock. I managed the till. Then I left."), /start with "i managed"/i));
  check("a repeated stock phrase is flagged", has(styleNotes("That is the kind of work your role needs. Later on, that is the kind of work your role needs again."), /Repeats the phrase/));
  check("a very long sentence is flagged", has(styleNotes(`${"word ".repeat(45)}end.`), /very long/));
  check("a normal CV bullet raises nothing", styleNotes("Coordinated weekly deliveries for a team of eight drivers").length === 0);

  // ---------- The shared prompt block ----------
  check("the style rules name the tells and forbid em dashes", /leverage/.test(STYLE_RULES) && /No em dashes/.test(STYLE_RULES) && AI_TELLS.length > 15);
  check("the style rules say facts always win", /truthfulness rules always win/i.test(STYLE_RULES));

  // ---------- The letter: voice and sample go in the user message only ----------
  const usageOf = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const letterText = "Dear Hiring Manager,\n\nI ran the weekly stock count.\n\nKind regards,\nJane";
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        calls.push(params);
        return kindOf(params) === "submit_letter"
          ? jsonReply({ letter: letterText }, usageOf)
          : jsonReply({ supported: true, unsupportedClaims: [] }, usageOf);
      },
    },
  } as unknown as MessagesClient;
  const cv = "Jane\n\nEXPERIENCE\n- Ran the weekly stock count\n- Trained two new starters";
  await generateLetter(
    { cv, jd: "Stock controller", accepted: [], gapKeywords: [], voice: { description: "Short, plain sentences. Past tense.", favouriteVerbs: ["ran", "trained"] }, writingSample: "Hi Sam, thanks for the note. Happy to talk it through on Friday if that suits." },
    client,
  );
  const letterCall = calls.find((c) => kindOf(c) === "submit_letter")!;
  const sys = JSON.stringify(letterCall.system);
  const user = JSON.stringify(letterCall.messages);
  check("the writing sample and voice notes are in the user message", /Happy to talk it through/.test(user) && /Short, plain sentences/.test(user) && /Verbs they use: ran, trained/.test(user));
  check("the writing sample is never in the cached system prompt", !/Happy to talk it through/.test(sys) && !/Short, plain sentences/.test(sys));
  check("the letter prompt limits the sample to tone and bans facts and copying from it", /only for tone, rhythm/.test(sys) && /Never take a fact/.test(sys));
  check("the letter prompt includes the shared style rules", /No em dashes/.test(sys));
  check("the old fixed linking sentence is gone from the letter prompt", !/That is the kind of work your role needs/.test(sys));

  const plain = (await (async () => {
    calls.length = 0;
    await generateLetter({ cv, jd: "Stock controller", accepted: [], gapKeywords: [] }, client);
    return JSON.stringify(calls.find((c) => kindOf(c) === "submit_letter")!.messages);
  })());
  check("without a sample or voice the user message has no style block", !/How the candidate writes/.test(plain));

  const long = "x".repeat(5000);
  calls.length = 0;
  await generateLetter({ cv, jd: "Stock controller", accepted: [], gapKeywords: [], writingSample: long }, client);
  const sent = JSON.stringify(calls.find((c) => kindOf(c) === "submit_letter")!.messages);
  check("an over-long sample is cut to 2,000 characters", (sent.match(/x/g) ?? []).length === 2000);

  // ---------- The analysis: voice is read from the CV and checked in code ----------
  const analysisCv = "Jane Sample\n\nEXPERIENCE\n- Ran the weekly stock count for the shop\n- Trained two new starters on the till";
  const base = {
    scores: { roleMatch: { score: 60, reason: "ok" }, impact: { score: 50, reason: "ok" }, keywords: { score: 50, reason: "ok" }, clarity: { score: 70, reason: "ok" } },
    strengths: [],
    gaps: [],
    rewrites: [],
    achievements: { emphasise: [], quantify: [] },
    keywords: { present: [], addTruthfully: [], gaps: [] },
  };
  const aCalls: Record<string, unknown>[] = [];
  const aClient = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        aCalls.push(params);
        return jsonReply({ ...base, voiceDescription: "Short, plain, past tense, no pronouns.", voiceVerbs: "Ran, Trained, Orchestrated" }, usageOf);
      },
    },
  } as unknown as MessagesClient;
  const out = await analyse(analysisCv, "Stock controller needed.", aClient);
  check("voice is passed through to the result", out.result.voice?.description.startsWith("Short, plain") === true);
  check("a favourite verb that is not in the CV is dropped", JSON.stringify(out.result.voice?.favouriteVerbs) === JSON.stringify(["Ran", "Trained"]));
  const aSys = JSON.stringify(aCalls[0].system);
  check("the analysis prompt asks for the voice and carries the style rules", /voiceDescription/.test(aSys) && /No em dashes/.test(aSys));

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
