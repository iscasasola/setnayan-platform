import { Globe, Lock } from 'lucide-react';

/**
 * The Recap's PRIVATE / PUBLIC mark — ONE drawing, two seats: beside the title of `RecapCard`, and beside the title of
 * its keepsake sheet on Memories (owner 2026-11-20, "memories approved": *"the Private mark stays beside the title"*).
 * Presentational only (no hooks, no reads), so the client keepsake row can draw it without pulling the card's reads in.
 */
export function RecapPrivacyPill({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] uppercase tracking-[0.15em] ${
        published ? 'bg-success-100 text-success-700' : 'bg-ink/5 text-ink/70'
      }`}
      data-recap-privacy={published ? 'public' : 'private'}
    >
      {published ? <Globe aria-hidden className="h-3 w-3" strokeWidth={2.25} /> : <Lock aria-hidden className="h-3 w-3" strokeWidth={2.25} />}
      {published ? 'Public' : 'Private'}
    </span>
  );
}
