import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { paletteSwatches, sealColorFromPalette } from '@/lib/site-palette';
import { fallbackSeedFromPublicId, sanitizeWaxSealConfig } from '@/lib/wax-seal/types';
import { WaxStampMaker } from './wax-stamp-maker';

export const metadata = { title: 'Make your wax seal · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

/** Short couple monogram for the lettered die, e.g. "A & J". */
function monogramText(name: string): string {
  const parts = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = parts[0] ?? '';
  const b = parts[1] ?? '';
  if (a && b) return `${a.charAt(0)} & ${b.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

// A few classic sealing-wax tones, so the picker is never empty even when the
// Mood Board is thin. The couple's moodboard swatches lead; their deep accent is
// the default selection.
const CLASSIC_WAX = ['#7c1c2b', '#5c2542', '#2f5043', '#1f3a5f', '#8a5a1c', '#3a3a3a'];

export default async function StampMakerPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'public_id, display_name, monogram_custom_svg, monogram_uploaded_svg, role_palette, wax_seal_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  const markSvg =
    (typeof event?.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event?.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);

  const palette = sanitizeRolePalette(event?.role_palette);
  const defaultWaxColor = sealColorFromPalette(palette);
  const swatches = Array.from(
    new Set([defaultWaxColor, ...paletteSwatches(palette), ...CLASSIC_WAX]),
  ).slice(0, 10);
  const fallbackSeed = fallbackSeedFromPublicId(event?.public_id);
  const existing = sanitizeWaxSealConfig(event?.wax_seal_config);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons/save-the-date`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Save the Date
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Make your wax seal</h1>
        <p className="max-w-prose text-base text-ink/65">
          Your monogram is the stamp. Pour the wax, wait for it to set, then press — every pour is
          one of a kind. Your seal holds your invitation closed until a guest swipes it away.
        </p>
      </header>

      <WaxStampMaker
        eventId={eventId}
        markSvg={markSvg}
        monogramText={monogramText(event?.display_name ?? '')}
        defaultWaxColor={defaultWaxColor}
        swatches={swatches}
        fallbackSeed={fallbackSeed}
        existing={existing}
      />
    </section>
  );
}
