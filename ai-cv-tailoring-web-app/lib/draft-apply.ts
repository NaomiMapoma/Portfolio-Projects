import type { Bullet } from "./bullets";
import type { AcceptedRewrite } from "./export";
import type { DraftChange, DraftMove } from "./draft-types";

// Works out which lines to apply to the CV from the draft and the user's choices. Pure functions, no tokens. Used by
// the preview and by every download, so they always agree.

export const orderKey = (move: DraftMove) => `order:${move.key}`;

const unchanged = (c: DraftChange) => c.action !== "cut" && c.newText === c.original;

/**
 * The lines to apply. Rewords and cuts first (unless the user put that line back), then each active reorder: the line
 * in a position takes the final text of the line that now sits there (its reworded text if it has one). A reorder that
 * includes a line which is cut is not applied.
 */
export function applyDraft(
  changes: DraftChange[],
  moves: DraftMove[],
  useOriginal: Record<string, boolean>,
  bullets: Bullet[],
): AcceptedRewrite[] {
  const original = new Map(bullets.map((b) => [b.id, b.text]));
  const out = new Map<string, AcceptedRewrite>();
  const reworded = new Map<string, string>();
  const cut = new Set<string>();
  for (const c of changes) {
    if (useOriginal[c.id] || unchanged(c)) continue;
    if (c.action === "cut") {
      cut.add(c.id);
      out.set(c.id, { id: c.id, text: "", remove: true });
    } else {
      reworded.set(c.id, c.newText);
      out.set(c.id, { id: c.id, text: c.newText });
    }
  }
  for (const m of moves) {
    if (useOriginal[orderKey(m)] || m.original.some((id) => cut.has(id))) continue;
    m.original.forEach((position, i) => {
      const content = m.ids[i];
      if (content === position) return;
      const text = reworded.get(content) ?? original.get(content);
      if (text !== undefined) out.set(position, { id: position, text });
    });
  }
  // A line whose final text is its own original needs no change.
  return [...out.values()].filter((a) => a.remove || a.text !== original.get(a.id));
}
