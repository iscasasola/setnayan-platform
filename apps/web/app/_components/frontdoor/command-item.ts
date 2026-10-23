/**
 * HomeCommandItem — one row of the signed-in search index (`command-data.ts` builds them; the results page
 * `front-door-results.tsx` and the step-out row `command-escape.ts` read them).
 *
 * Moved here 2026-10-22 when the top-bar palette that used to own this type (`home-command-bar.tsx`) was retired with
 * the top bar's 🔍 (owner, "One thumb row": the search lives in each list's thumb row). The index and its results
 * page are unchanged.
 */
export type HomeCommandItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  kind: 'event' | 'space' | 'action' | 'supplier';
  /** Searchable words that are never rendered — see `lib/command-match.ts`.
   *  This is how typing "kasal" finds a WEDDING-badged event. */
  terms?: string;
  /** Icon key — resolved to a Lucide glyph client-side (RSC boundary rule:
   *  never pass component functions from server to client). */
  icon:
    | 'sparkles'
    | 'store'
    | 'shield'
    | 'plus'
    | 'calendar'
    | 'grid'
    | 'users'
    | 'user'
    | 'bell'
    | 'wand'
    | 'clapperboard'
    | 'heart';
};
