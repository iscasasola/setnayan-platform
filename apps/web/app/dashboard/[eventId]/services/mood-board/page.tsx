import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { saveRolePalette } from './actions';
import { PaletteEditor } from './_components/palette-editor';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, role_palette, mood_board_updated_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const palette = sanitizeRolePalette(event.role_palette ?? {});

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/services`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to services
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0010 · Mood Board (V1 MVP)
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Per-role palette
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick a palette per group — different size bands per role tier. The Wedding Party and
          plain guests get 3–6 colors each; sponsors, bearers, and officiants get 1–3. The
          Guest List shows the first color as a small dot beside each role chip. The full
          Setnayan Guide rule engine + 20-theme library ship in a later revision.
        </p>
        {event.mood_board_updated_at ? (
          <p className="text-xs text-ink/55">
            Last saved {new Date(event.mood_board_updated_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      <PaletteEditor
        eventId={eventId}
        initial={palette}
        saveAction={saveRolePalette}
      />

      <section className="space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming later
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>20-theme curated library</li>
          <li>Setnayan Guide rule engine (cohesion · contrast · temperature · saturation)</li>
          <li>Venue palette extraction from venue photos</li>
          <li>Guests pick their dress-code color from the &ldquo;Plain guests&rdquo; palette</li>
          <li>Save palettes as named moods you can swap between</li>
        </ul>
      </section>
    </div>
  );
}
