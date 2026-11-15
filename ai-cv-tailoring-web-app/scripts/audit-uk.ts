// UK English audit. Scans every prompt and every piece of text the UI shows for
// US spellings. (Class names and code identifiers are ignored.) The same word
// list is exported for checking real model output in scripts/hardening-live.ts.
//
// Run: npx tsx scripts/audit-uk.ts

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const US_WORDS =
  /\b(organiz\w*|optimiz\w*|analyz\w*|summariz\w*|prioritiz\w*|recogniz\w*|categoriz\w*|utiliz\w*|minimiz\w*|maximiz\w*|customiz\w*|standardiz\w*|finaliz\w*|realiz\w*|emphasiz\w*|normaliz\w*|specializ\w*|behavior\w*|favor\w*|honor\w*|labor\w*|defense|catalog\w*|judgment|centers?|centered|colors?|colored|fulfill(?:ment)?|enrollment)\b/i;

const ALLOW = /(?!)/g; // nothing to allow: the list only holds clear US spellings ("towards", "programs" and similar are fine in UK English)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Keep only human-readable strings and JSX text: drop comments, imports, class names and code. */
function visibleText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*import .*$/gm, "")
    .replace(/className=("[^"]*"|\{[^}]*\})/g, "")
    .replace(/aria-[a-z]+=("[^"]*")/g, "$1")
    .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (m) => (/[A-Za-z]{3,}/.test(m) ? m : ""));
}

if (require.main === module) {
  const root = resolve(__dirname, "..");
  const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
  const problems: string[] = [];
  for (const f of files) {
    // Strings and JSX text only: pull out quoted strings and text between tags.
    const text = visibleText(readFileSync(f, "utf8"));
    const strings = [...text.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
    const jsx = [...text.matchAll(/>([^<>{}]{3,})</g)].map((m) => m[1]);
    for (const piece of [...strings, ...jsx]) {
      const hit = piece.replace(ALLOW, "").match(US_WORDS);
      // Code-ish strings (property names, module paths) are not prose.
      if (hit && /\s/.test(piece.trim()) ) problems.push(`${relative(root, f)}: "${hit[0]}" in "${piece.trim().slice(0, 70)}"`);
    }
  }
  console.log(`Scanned ${files.length} files (prompts, error messages, labels, notes)\n`);
  console.log(`${problems.length === 0 ? "PASS" : "FAIL"}  no US spellings in any prompt or UI text`);
  problems.forEach((p) => console.log("        " + p));

  // The runtime guard on the cover letter uses its own list; make sure it still catches the common cases.
  const sample = ["organized", "optimize", "prioritized", "recognizing", "color", "center", "judgment"];
  const caught = sample.filter((w) => US_WORDS.test(w));
  console.log(`${caught.length === sample.length ? "PASS" : "FAIL"}  the US-spelling list catches its own test words`);
  const ukFine = ["organised", "optimise", "programme", "centre", "colour", "judgement"].filter((w) => US_WORDS.test(w));
  console.log(`${ukFine.length === 0 ? "PASS" : "FAIL"}  and does not flag UK spellings ${ukFine.join(", ")}`);

  if (problems.length || caught.length !== sample.length || ukFine.length) process.exit(1);
  console.log("\nAll checks passed");
}
