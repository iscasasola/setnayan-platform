import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sealColorFromPalette, veilColorFromPalette } from '@/lib/site-palette';
import { RevealPreviewCard } from '@/app/dashboard/[eventId]/_components/reveal-preview-card';

// 2026-06-16 — owner "replace": this page IS now the Save-the-Date *reveal*
// (the opening animation that uncovers the couple's wedding page), not the old
// paid ₱99 Save-the-Date VIDEO render. The video SKU (`save_the_date_video`),
// its template library (`@/lib/save-the-date`) and checkout/Feature-Us infra
// are left intact (existing orders + catalog unaffected) — they're just no
// longer surfaced here. Loose ends to resolve next: the add-ons hub tile +
// /pricing still describe the video SKU; chooser persistence + content editor.

export const metadata = { title: 'Save the Date · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

export default async function SaveTheDatePage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date, monogram_custom_svg, monogram_uploaded_svg, role_palette')
    .eq('event_id', eventId)
    .maybeSingle();

  // The couple's real monogram mark for the wax seal — their own upload outranks
  // the AI/Cipher mark (owner rule 2026-06-15); null → lettered seal fallback.
  const markSvg =
    (typeof event?.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event?.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);

  const palette = sanitizeRolePalette(event?.role_palette);
  const waxColor = sealColorFromPalette(palette);
  const veilColor = veilColorFromPalette(palette);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Save the Date</h1>
        <p className="max-w-prose text-base text-ink/65">
          When a guest opens your invitation link, your wedding page opens with a reveal that
          uncovers your Save the Date. Choose the opening you love — it recolours to your Mood
          Board and plays on your live page automatically. Included with your website, free.
        </p>
      </header>

      <RevealPreviewCard
        displayName={event?.display_name ?? ''}
        dateIso={event?.event_date ?? null}
        markSvg={markSvg}
        waxColor={waxColor}
        veilColor={veilColor}
      />
    </section>
  );
}
