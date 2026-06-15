import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EDITORIAL_SECTION_KEYS,
  type EditorialSections,
} from '@/app/[slug]/_components/editorial/data';
import { EditorialEditor } from './_components/editorial-editor';
import type { EditorialEditorInput } from './actions';

/**
 * Consolidated editorial editor (iteration 0046). One page where the couple
 * controls their post-event "front-page story": the words (→ draft_json), which
 * features show (→ draft_json.sections), and links out to the piece-editors for
 * the living hero, photos, and thank-you note. The compose engine already
 * prefers these draft_json fields; EditorialContent gates each optional block on
 * the section map. Event is read under the host session (RLS-scoped); the
 * composer-owned event_editorial row is read via the admin client.
 */
export const metadata = { title: 'Editorial' };

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default async function EditorialEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select('event_id, display_name, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !event) notFound();

  let draft: Record<string, unknown> = {};
  let status = 'draft';
  try {
    const admin = createAdminClient();
    const { data: ed } = await admin
      .from('event_editorial')
      .select('draft_json, status')
      .eq('event_id', eventId)
      .maybeSingle();
    if (ed?.draft_json && typeof ed.draft_json === 'object') {
      draft = ed.draft_json as Record<string, unknown>;
    }
    if (typeof ed?.status === 'string') status = ed.status;
  } catch {
    // best-effort — fall back to empty defaults (engine auto-writes everything).
  }

  const sectionsRaw =
    draft.sections && typeof draft.sections === 'object'
      ? (draft.sections as Record<string, unknown>)
      : {};
  const sections = EDITORIAL_SECTION_KEYS.reduce((acc, k) => {
    acc[k] = sectionsRaw[k] !== false; // default on
    return acc;
  }, {} as EditorialSections);

  const leadArr = Array.isArray(draft.lead_paragraphs)
    ? (draft.lead_paragraphs as unknown[]).map(str).filter(Boolean)
    : [];

  const initial: EditorialEditorInput = {
    headline: str(draft.headline),
    deck: str(draft.deck),
    superKicker: str(draft.super) || str(draft.kicker),
    byline: str(draft.byline),
    leadParagraphs: leadArr.join('\n\n'),
    pullQuote: str(draft.pull_quote) || str(draft.pullQuote),
    sections,
    publish: status === 'published',
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/${eventId}/website`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/65 transition-colors hover:text-burgundy focus-visible:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to website</span>
      </Link>

      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl italic text-ink sm:text-4xl">Editorial</h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Your wedding&rsquo;s front-page story — published after the day. Write the words, choose your
          photos and hero, and pick which features show. We write polished defaults for anything you leave
          blank, so it always reads beautifully.
        </p>
      </header>

      <EditorialEditor eventId={eventId} slug={event.slug ?? null} initial={initial} />
    </main>
  );
}
