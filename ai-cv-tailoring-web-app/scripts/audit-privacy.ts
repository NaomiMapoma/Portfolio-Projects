// Privacy audit (static). Checks that the app never stores CV or job text, only
// sends it to the Claude API from server code, never logs bodies, never exposes
// the API key to the browser, and that tab switches make no API calls.
//
// Run after a build so the browser bundle can be scanned too:
//   npm run build && npx tsx scripts/audit-privacy.ts

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n        ${detail}` : ""}`);
  if (!ok) failed++;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Remove comments so a mention in a comment isn't mistaken for code. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const files = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d)));
const src = new Map(files.map((f) => [f, stripComments(readFileSync(f, "utf8"))]));
const rel = (f: string) => relative(ROOT, f);
const anyFile = (re: RegExp) => [...src].filter(([, s]) => re.test(s)).map(([f]) => rel(f));

console.log(`Scanning ${files.length} source files in app/, components/ and lib/\n`);

// ---------- 1. Nothing is stored ----------
const storage = anyFile(/localStorage|sessionStorage|document\.cookie|indexedDB|\bcookies\s*\(|navigator\.sendBeacon|caches\.open/);
check("no localStorage, sessionStorage, cookies, indexedDB or beacons", storage.length === 0, storage.join(", "));

const fsUse = anyFile(/from\s+["'](node:)?fs(\/promises)?["']|require\(["'](node:)?fs|writeFile|appendFile|createWriteStream|mkdtemp|\.mkdir\(/);
check("no file system access (nothing written to disk)", fsUse.length === 0, fsUse.join(", "));

const dbUse = anyFile(/prisma|sqlite|mongoose|better-sqlite|\bpg\b|redis/i);
check("no database", dbUse.length === 0, dbUse.join(", "));

// ---------- 2. Network: only our own API, and the Claude API from the server ----------
const fetchCalls: { file: string; url: string }[] = [];
for (const [f, s] of src) for (const m of s.matchAll(/\bfetch\(\s*([^,)]+)/g)) fetchCalls.push({ file: rel(f), url: m[1].trim() });
const clientFetches = fetchCalls.filter((c) => !c.file.startsWith("lib/"));
check(
  "every browser fetch goes to our own /api routes",
  clientFetches.every((c) => /^["'`]\/api\//.test(c.url)),
  clientFetches.filter((c) => !/^["'`]\/api\//.test(c.url)).map((c) => `${c.file}: ${c.url}`).join(", "),
);
const libFetches = fetchCalls.filter((c) => c.file.startsWith("lib/"));
check(
  "the only server-side fetch is lib/jd-text.ts fetching the job page URL the user gave (no CV text is sent in it)",
  libFetches.every((c) => c.file === "lib/jd-text.ts"),
  libFetches.map((c) => c.file).join(", "),
);
const jdFetchSrc = src.get(join(ROOT, "lib/jd-text.ts")) ?? "";
check("that job page request carries no CV text (a GET with fixed headers only)", !/body\s*:|method\s*:\s*["']POST/.test(jdFetchSrc));

const sdkUsers = anyFile(/@anthropic-ai\/sdk/);
check("the Claude SDK is used only in lib/claude.ts and lib/claude-shared.ts (types)", sdkUsers.every((f) => ["lib/claude.ts", "lib/claude-shared.ts"].includes(f)), sdkUsers.join(", "));
const otherHosts = [...src].flatMap(([f, s]) => [...s.matchAll(/https?:\/\/(?!localhost|www\.w3\.org|schemas\.openxmlformats|example\.com)[^\s"'`)]+/g)].map((m) => `${rel(f)}: ${m[0]}`));
check("no third-party URLs in the code (no analytics, tracking or other services)", otherHosts.length === 0, otherHosts.join("\n        "));

// ---------- 3. Logging: only status, timing and token counts ----------
const ALLOWED = new Set(["Date", "now", "started", "checkStarted", "attempt", "usage", "factCheckUsage", "input", "output", "cacheRead", "cacheWrite", "e", "apiStatus", "parsed", "success"]);
const logProblems: string[] = [];
let logCount = 0;
for (const [f, s] of src) {
  for (const m of s.matchAll(/console\.\w+\(([\s\S]*?)\);/g)) {
    logCount++;
    const arg = m[1];
    if (!arg.trim().startsWith("`")) {
      logProblems.push(`${rel(f)}: non-template console argument: ${arg.trim().slice(0, 60)}`);
      continue;
    }
    for (const expr of arg.matchAll(/\$\{([^}]*)\}/g)) {
      // ignore words inside quoted literals such as "ok" / "invalid"
      for (const id of expr[1].replace(/"[^"]*"|'[^']*'/g, "").match(/[A-Za-z_]\w*/g) ?? []) {
        if (!ALLOWED.has(id)) logProblems.push(`${rel(f)}: logs "${id}" in \`${arg.trim().slice(0, 60)}\``);
      }
    }
  }
}
check(`all ${logCount} console calls log only status, timing and token counts`, logProblems.length === 0, logProblems.join("\n        "));
const bodyLog = anyFile(/console\.\w+\([^)]*(request|response|\.body|\.json\(\)|req\b)/);
check("no request or response bodies are logged", bodyLog.length === 0, bodyLog.join(", "));

// The optional writing sample is user text like the CV: it may only be read by the cover letter UI, request and server code,
// and it must never reach a log line, storage or any other route.
const sampleFiles = anyFile(/writingSample|writing-sample|MAX_SAMPLE_CHARS/);
// ResultsStep and ExportTab only pass the "generate" callback down (its argument is the sample); the log and storage checks below cover them too.
const sampleAllowed = ["app/page.tsx", "app/api/cover-letter/route.ts", "components/CoverLetterSection.tsx", "components/ResultsStep.tsx", "components/ExportTab.tsx", "lib/letter.ts", "lib/limits.ts"];
check("the writing sample is handled only by the cover letter UI, route and letter code", sampleFiles.every((f) => sampleAllowed.includes(f)), sampleFiles.filter((f) => !sampleAllowed.includes(f)).join(", "));
const sampleLogged = [...src].filter(([, s]) => /console\.\w+\([^;]*(writingSample|sample)/.test(s)).map(([f]) => rel(f));
check("the writing sample is never logged", sampleLogged.length === 0, sampleLogged.join(", "));
const sampleStored = [...src].filter(([, s]) => /(localStorage|sessionStorage|cookie)[^;]*(writingSample|sample)|(writingSample|sample)[^;]*(localStorage|sessionStorage|cookie)/.test(s)).map(([f]) => rel(f));
check("the writing sample is never put in browser storage", sampleStored.length === 0, sampleStored.join(", "));

// ---------- 4. Responses are not cached ----------
const routeFiles = files.filter((f) => /app\/api\/.*route\.ts$/.test(f));
const cacheProblems: string[] = [];
for (const f of routeFiles) {
  const s = src.get(f)!;
  for (const m of s.matchAll(/Response\.json\(/g)) {
    // take the balanced call text
    let depth = 0;
    let i = m.index! + "Response.json".length;
    const start = i;
    for (; i < s.length; i++) {
      if (s[i] === "(") depth++;
      if (s[i] === ")" && --depth === 0) break;
    }
    const call = s.slice(start, i + 1);
    if (!/headers|NO_STORE/.test(call)) cacheProblems.push(`${rel(f)}: ${call.slice(0, 70)}`);
  }
}
check(`every response from the ${routeFiles.length} API routes sends Cache-Control: no-store`, cacheProblems.length === 0, cacheProblems.join("\n        "));
const httpSrc = src.get(join(ROOT, "lib/http.ts")) ?? "";
check("the shared no-store header is exactly 'no-store'", /Cache-Control["']?\s*:\s*["']no-store["']/.test(httpSrc));

// ---------- 5. The API key and server code never reach the browser ----------
const SERVER_ONLY = [/@anthropic-ai\/sdk/, /unpdf/, /mammoth/, /jsdom/, /@mozilla\/readability/, /from\s+["']node:/, /process\.env/, /from\s+["']@\/lib\/(claude|letter|factcheck|cv-text|jd-text|http)["']/, /from\s+["']\.\/(claude|letter|factcheck|cv-text|jd-text|http)["']/];
function importsOf(file: string): string[] {
  const out: string[] = [];
  for (const m of (src.get(file) ?? "").matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] ?? m[2];
    const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
    if (!base) continue;
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) if (src.has(base + ext)) out.push(base + ext);
  }
  return out;
}
const clientRoots = files.filter((f) => /^["']use client["']/.test(readFileSync(f, "utf8").trimStart()));
const reachable = new Set<string>(clientRoots);
const queue = [...clientRoots];
while (queue.length) {
  for (const n of importsOf(queue.pop()!)) {
    if (!reachable.has(n)) {
      reachable.add(n);
      queue.push(n);
    }
  }
}
// components imported by app/page.tsx without their own directive are client code too
for (const f of files) if (f.startsWith(join(ROOT, "components"))) reachable.add(f);
const leaked = [...reachable].filter((f) => SERVER_ONLY.some((re) => re.test(src.get(f) ?? "")));
check(`no browser-side file (${reachable.size} checked) imports server-only code, the SDK or reads environment variables`, leaked.length === 0, leaked.map(rel).join(", "));
const keyReaders = anyFile(/process\.env\.ANTHROPIC_API_KEY/).sort();
check("ANTHROPIC_API_KEY is read only in lib/claude.ts, plus the health route which only checks it exists", keyReaders.join() === ["app/api/health/route.ts", "lib/claude.ts"].join(), keyReaders.join(", "));
const health = src.get(join(ROOT, "app/api/health/route.ts")) ?? "";
check("the health route returns only a yes/no, never the key", /keyConfigured:\s*Boolean\(/.test(health) && !/ANTHROPIC_API_KEY\s*[,}]/.test(health.replace("Boolean(process.env.ANTHROPIC_API_KEY)", "")));

const staticDir = join(ROOT, ".next/static");
if (existsSync(staticDir)) {
  const bundle = (function all(d: string): string[] {
    return readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? all(join(d, n)) : /\.(js|css|map)$/.test(n) ? [join(d, n)] : []));
  })(staticDir);
  const pattern = /sk-ant-|@anthropic-ai|api\.anthropic\.com|process\.env\.ANTHROPIC/;
  const bad = bundle.filter((f) => pattern.test(readFileSync(f, "utf8")));
  check(`the browser bundle (${bundle.length} files) contains no key value, no SDK, no Anthropic URL and no read of the key`, bad.length === 0, bad.map(rel).join(", "));
} else {
  check("browser bundle scan (needs a build: run `npm run build` first)", false, ".next/static not found");
}

const repoText = ["app", "components", "lib", "scripts", "docs", "README.md", "CLAUDE.md", ".env.local.example"].flatMap((p) => {
  const full = join(ROOT, p);
  if (!existsSync(full)) return [];
  return statSync(full).isDirectory() ? walk(full) : [full];
});
check("no API key value is written anywhere in the repo", !repoText.some((f) => /sk-ant-[A-Za-z0-9_-]{10,}/.test(readFileSync(f, "utf8"))));
check("a real .env.local is git-ignored", /^\.env\.local$/m.test(readFileSync(join(ROOT, ".gitignore"), "utf8")));

// ---------- 6. Model names come from the environment ----------
const modelLiterals = anyFile(/claude-(sonnet|haiku|opus|fable|mythos)/).filter((f) => f !== "lib/models.ts");
check("model names appear only in lib/models.ts (as defaults) and are read from environment variables", modelLiterals.length === 0, modelLiterals.join(", "));
const models = src.get(join(ROOT, "lib/models.ts")) ?? "";
check("lib/models.ts reads ANTHROPIC_MODEL and ANTHROPIC_FAST_MODEL", /process\.env\.ANTHROPIC_MODEL/.test(models) && /process\.env\.ANTHROPIC_FAST_MODEL/.test(models));

// ---------- 7. Switching tabs makes no API calls ----------
const effectProblems: string[] = [];
for (const [f, s] of src) {
  for (const m of s.matchAll(/useEffect\(/g)) {
    let depth = 0;
    let i = m.index! + "useEffect".length;
    const start = i;
    for (; i < s.length; i++) {
      if (s[i] === "(") depth++;
      if (s[i] === ")" && --depth === 0) break;
    }
    const block = s.slice(start, i + 1);
    for (const fm of block.matchAll(/\bfetch\(\s*([^,)]+)/g)) {
      if (!/["'`]\/api\/health["'`]/.test(fm[1])) effectProblems.push(`${rel(f)}: fetch(${fm[1]}) inside useEffect`);
    }
    if (/\b(analyse|runAssessment|runDraft|runRework|requestDraft|generateLetter|downloadPrimary|onGenerateLetter)\s*\(/.test(block)) effectProblems.push(`${rel(f)}: an AI action is called inside useEffect`);
  }
}
check("no useEffect makes an API call (the only exception is the yes/no key check on first load)", effectProblems.length === 0, effectProblems.join("\n        "));
// The AI requests: the assessment (and later the draft and the cover letter). Each is made from a function that
// only a button click runs.
const analyseCalls = clientFetches.filter((c) => /assess|draft|analyse|cover-letter/.test(c.url));
const pageSource = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
check(
  "assessment, draft, rework and cover letter requests are made only from functions run by a button click",
  analyseCalls.length === 3 &&
    /onAnalyse=\{runAssessment\}/.test(pageSource) &&
    /async function runAssessment/.test(pageSource) &&
    /onDraft=\{runDraft\}/.test(pageSource) &&
    /onRework=\{runRework\}/.test(pageSource) &&
    /async function requestDraft/.test(pageSource) &&
    /onGenerate=\{\(sample\) => void generateLetter\(sample\)\}/.test(pageSource),
);

// ---------- 8. The privacy note is shown ----------
const NOTE = "Your CV, job description and notes are sent securely to the Claude API only to produce your assessment, draft and cover letter. This app does not store them. Anthropic&apos;s own retention policy applies on its side.";
const inputs = readFileSync(join(ROOT, "components/InputsStep.tsx"), "utf8").replace(/\s+/g, " ");
check("the privacy note is on the inputs screen next to the Assess button", inputs.includes(NOTE.replace(/\s+/g, " ")) && inputs.indexOf("Assess my CV") < inputs.indexOf("Your CV, job description and notes are sent securely"));
check("the cover letter section says the same before sending", /sends your CV and job description to the Claude API/.test(readFileSync(join(ROOT, "components/CoverLetterSection.tsx"), "utf8").replace(/\s+/g, " ")));

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
