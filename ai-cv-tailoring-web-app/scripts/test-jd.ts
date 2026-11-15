// Checks the URL safety rules and the job text cleaning.
// Run: npx tsx scripts/test-jd.ts

import { assertSafeUrl, cleanJdText, extractJobText, isPrivateIp } from "../lib/jd-text";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

async function blocked(url: string): Promise<boolean> {
  try {
    await assertSafeUrl(url);
    return false;
  } catch {
    return true;
  }
}

async function main() {
  for (const url of [
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.20.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://user:pass@example.com/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "not a url",
  ]) {
    check(`blocks ${url}`, await blocked(url));
  }

  check("public IPv4 allowed", !isPrivateIp("93.184.216.34"));
  check("public IPv6 allowed", !isPrivateIp("2606:2800:220:1:248:1893:25c8:1946"));
  check("172.32.x is public", !isPrivateIp("172.32.0.1"));

  const html = `<html><body>
    <nav>Home Jobs Sign in</nav>
    <p>We use cookies to improve your experience.</p>
    <article>
      <h1>Programme Manager</h1>
      <p>You will lead delivery of digital change programmes across several teams, working
      closely with senior stakeholders and managing risks, issues and dependencies.</p>
      <h2>Requirements</h2>
      <ul><li>Experience of agile delivery</li><li>Strong stakeholder management skills</li></ul>
      <p>Share this job</p>
    </article>
  </body></html>`;
  const text = extractJobText(html);
  console.log("\n--- extracted ---\n" + text + "\n-----------------\n");
  check("keeps responsibilities", text.includes("lead delivery of digital change"));
  check("keeps requirements", text.includes("stakeholder management"));
  check("drops 'Share this job'", !/share this job/i.test(text));

  const ld = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "JobPosting",
    title: "Paid Social Manager",
    description:
      "<h2>The role</h2><p>You will plan and optimise paid social campaigns across several channels, working with design and analytics teams to improve results. You will test new audiences and creative, report on performance to senior marketing leaders, and decide where the next pound of budget should go.</p><ul><li>Own the budget</li><li>Report weekly</li></ul>",
  })}</script></head><body><div id="root"></div></body></html>`;
  const ldText = extractJobText(ld);
  check("reads JobPosting JSON-LD from JS-rendered pages", ldText.startsWith("Paid Social Manager") && ldText.includes("Own the budget\nReport weekly"));

  const cleaned = cleanJdText("Accept all cookies\n\n\n\nSenior   Analyst\nApply now\nSave job\nSkills:  SQL");
  check("cleanJdText removes boilerplate and extra spacing", cleaned === "Senior Analyst\nSkills: SQL");

  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

void main();
