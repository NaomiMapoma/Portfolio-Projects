import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

// Job description fetching and cleaning. Server-side only, in memory only.
// Nothing is written to disk and nothing is logged.

export const FRIENDLY_FETCH_ERROR =
  "I couldn't read that page. Please paste the job description instead.";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 3;
const MIN_USEFUL_CHARS = 200;

export class JdFetchError extends Error {}

// ---------- URL safety ----------

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
];

/** True for private, loopback, link-local, multicast and other internal addresses. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const size = 2 ** (32 - bits);
      const start = ipv4ToInt(base);
      return n >= start && n < start + size;
    });
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // Hex form of an IPv4-mapped address, e.g. ::ffff:7f00:1
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // fc00::/7 unique local
      /^fe[89ab]/.test(lower) || // fe80::/10 link-local
      lower.startsWith("ff") // multicast
    );
  }
  return true; // not a valid IP: treat as unsafe
}

/** Throws unless the URL is http(s) and every address it resolves to is public. */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new JdFetchError("bad url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new JdFetchError("bad protocol");
  if (url.username || url.password) throw new JdFetchError("credentials in url");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new JdFetchError("blocked host");
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new JdFetchError("blocked address");
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new JdFetchError("dns failure");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new JdFetchError("blocked address");
  }
  // Note: DNS could change between this check and the connection (rebinding).
  // Accepted for a local-only app.
  return url;
}

// ---------- Fetching ----------

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new JdFetchError("empty body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new JdFetchError("too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchPage(rawUrl: string): Promise<string> {
  let url = await assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FastTrack local app)",
          Accept: "text/html,text/plain;q=0.9",
        },
      });
    } catch {
      throw new JdFetchError("request failed");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new JdFetchError("bad redirect");
      url = await assertSafeUrl(new URL(location, url).toString()); // re-check every hop
      continue;
    }

    if (!res.ok) throw new JdFetchError(`status ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new JdFetchError("not a web page");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new JdFetchError("too large");
    return readLimited(res);
  }
  throw new JdFetchError("too many redirects");
}

// ---------- Extraction and cleaning ----------

const BOILERPLATE_LINE = [
  /cookie/i,
  /^accept( all)?( cookies)?$/i,
  /^(reject|decline|manage|customi[sz]e)( all)?( cookies| preferences| settings)?$/i,
  /privacy (policy|notice)/i,
  /^(skip to (main )?content|home|menu|search|sign in|log ?in|log ?out|register|sign up|jobs|careers|about us|contact( us)?)$/i,
  /share (this )?(job|vacancy|role|page)/i,
  /^share( on)?( (facebook|twitter|x|linkedin|email|whatsapp))?$/i,
  /^(apply( now| for this job)?|save( this)? job|back to (results|search|jobs)|print|report this job|email (a )?friend)$/i,
  /^(facebook|twitter|linkedin|instagram|youtube|whatsapp)$/i,
  /all rights reserved/i,
  /^©/,
];

/** Collapse whitespace and drop obvious boilerplate lines. */
export function cleanJdText(input: string): string {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t]/g, " ")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .filter((l) => !BOILERPLATE_LINE.some((re) => re.test(l)));

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text of an element with a line break after each block, so list items don't run together. */
function blockText(root: Element): string {
  root.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  root.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  root
    .querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, div, tr, section, article, ul, ol, blockquote")
    .forEach((el) => el.append("\n"));
  return root.textContent ?? "";
}

type JsonLdNode = { "@type"?: string | string[]; "@graph"?: unknown; title?: string; description?: string };

function findJobPostings(node: unknown, out: JsonLdNode[] = []): JsonLdNode[] {
  if (Array.isArray(node)) node.forEach((n) => findJobPostings(n, out));
  else if (node && typeof node === "object") {
    const n = node as JsonLdNode;
    const types = ([] as string[]).concat(n["@type"] ?? []);
    if (types.includes("JobPosting")) out.push(n);
    if (n["@graph"]) findJobPostings(n["@graph"], out);
  }
  return out;
}

/**
 * Many job boards render the page with JavaScript but include the posting as
 * schema.org JobPosting data in the HTML (e.g. Ashby). Use it when present.
 */
function extractJobPostingJsonLd(html: string): string {
  const doc = new JSDOM(html).window.document;
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const posting = findJobPostings(JSON.parse(script.textContent ?? ""))[0];
      if (!posting?.description) continue;
      const body = new JSDOM(`<body>${posting.description}</body>`).window.document.body;
      const text = blockText(body);
      return posting.title ? `${posting.title}\n\n${text}` : text;
    } catch {
      // not valid JSON: ignore this block
    }
  }
  return "";
}

/** Main-content text from an HTML page. Scripts are never run. */
export function extractJobText(html: string, pageUrl?: string): string {
  const structured = cleanJdText(extractJobPostingJsonLd(html));
  if (structured.length >= MIN_USEFUL_CHARS) return structured;

  const dom = new JSDOM(html, { url: pageUrl }); // no runScripts, no resource loading
  const article = new Readability(dom.window.document).parse();
  let text = "";
  if (article?.content) {
    const body = new JSDOM(`<body>${article.content}</body>`).window.document.body;
    text = blockText(body);
  }
  if (text.trim().length < MIN_USEFUL_CHARS) {
    const body = new JSDOM(html).window.document.body;
    text = body ? blockText(body) : "";
  }
  return cleanJdText(text);
}

export async function fetchJobDescription(url: string): Promise<string> {
  const html = await fetchPage(url);
  const text = extractJobText(html, url);
  if (text.length < MIN_USEFUL_CHARS) throw new JdFetchError("not enough text");
  return text;
}
