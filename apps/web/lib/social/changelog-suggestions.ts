import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

/**
 * apps/web/lib/social/changelog-suggestions.ts
 *
 * Announcement-draft suggestions for the admin Social Queue composer —
 * the 5 newest repo CHANGELOG headlines (`## YYYY-MM-DD · title`, newest
 * first) so "what shipped this week" is one click from becoming an
 * announcement post.
 *
 * A plain server helper, NOT a server action — the queue page calls it at
 * render time. Best-effort by design: CHANGELOG.md lives at the repo root
 * and may simply not exist in the deployed bundle (Vercel only ships
 * traced files), so ANY error → [] and the composer just renders without
 * suggestions.
 */

export type ChangelogSuggestion = {
  /** YYYY-MM-DD from the heading. */
  date: string;
  /** The headline after the `·` separator. */
  title: string;
};

const HEADLINE_RE = /^## (\d{4}-\d{2}-\d{2}) · (.+)$/;

/**
 * CHANGELOG.md lives at the MONOREPO root. On Vercel process.cwd() is the
 * traced project root; in local dev `next dev` runs from apps/web — so walk
 * up to two levels before giving up.
 */
function readChangelog(): string {
  const candidates = [
    path.join(process.cwd(), 'CHANGELOG.md'),
    path.join(process.cwd(), '..', 'CHANGELOG.md'),
    path.join(process.cwd(), '..', '..', 'CHANGELOG.md'),
  ];
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, 'utf8');
    } catch {
      // try the next candidate
    }
  }
  throw new Error('CHANGELOG.md not found');
}

export function getChangelogSuggestions(): ChangelogSuggestion[] {
  try {
    const raw = readChangelog();
    const suggestions: ChangelogSuggestion[] = [];
    for (const line of raw.split('\n')) {
      const match = HEADLINE_RE.exec(line.trim());
      const date = match?.[1];
      const title = match?.[2];
      if (!date || !title) continue;
      suggestions.push({ date, title: title.trim() });
      if (suggestions.length >= 5) break; // CHANGELOG is newest-first
    }
    return suggestions;
  } catch {
    return []; // missing file / not bundled on Vercel / parse hiccup — degrade
  }
}
