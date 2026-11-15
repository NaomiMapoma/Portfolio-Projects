import { sectionKind, type Bullet } from "./bullets";
import { containsTerm, jdOnlyTerms } from "./keywords";
import { invalidNumbers } from "./numbers";
import type { Rewrite, RewriteDraft } from "./types";

// Code-level checks on rewrites (PRD section 7). Pure functions, no tokens.

export { invalidNumbers };

export type BuildResult = {
  /** Rewrites that passed the code checks, ready for the fact-check call. */
  rewrites: Rewrite[];
  /** How many were removed (unknown bullet, duplicate, or an invented number). */
  rejected: number;
};

/**
 * Fill in the original bullet text, and drop any rewrite that cites a bullet
 * that does not exist, repeats a bullet, or contains a number that is not in
 * the original bullet or a placeholder. Rejected rewrites are never shown.
 */
export function buildRewrites(drafts: RewriteDraft[], bullets: Bullet[], gapKeywords: string[] = []): BuildResult {
  const seen = new Set<string>();
  const rewrites: Rewrite[] = [];
  let rejected = 0;

  for (const d of drafts) {
    const bullet = bullets.find((b) => b.id === d.sourceBulletId);
    if (!bullet || seen.has(bullet.id)) {
      rejected++;
      continue;
    }

    // Skills lines are lists of tools: they can be cited as evidence but never rewritten.
    const kind = sectionKind(bullet.section);
    if (kind === "skills") {
      rejected++;
      continue;
    }

    const bad = [...invalidNumbers(bullet.text, d.lightTouch), ...invalidNumbers(bullet.text, d.strongerImpact)];
    if (bad.length > 0) {
      rejected++;
      continue;
    }

    // Gap keywords (terms the CV does not show) must never be injected into a rewrite.
    const injected = gapKeywords.some(
      (k) =>
        k.trim().length >= 3 &&
        !containsTerm(bullet.text, k) &&
        (containsTerm(d.lightTouch, k) || containsTerm(d.strongerImpact, k)),
    );
    if (injected) {
      rejected++;
      continue;
    }

    // The summary is dense with claims: a rewrite may not introduce a name (employer, brand, tool, regulator)
    // that the original paragraph does not contain.
    if (kind === "summary" && [...jdOnlyTerms(d.lightTouch, bullet.text), ...jdOnlyTerms(d.strongerImpact, bullet.text)].length > 0) {
      rejected++;
      continue;
    }

    // Only an accepted rewrite uses up its bullet, so a bad first attempt can't block a good one.
    seen.add(bullet.id);
    rewrites.push({ ...d, original: bullet.text, verification: "pending", issues: [], ...(kind === "summary" ? { kind: "summary" as const } : {}) });
  }
  return { rewrites, rejected };
}
