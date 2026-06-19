import { BookHeart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

/**
 * Kwento Magazine — Variant A card (0012 § Kwento Magazine): the FREE,
 * couple-private A4 keepsake. Renders once the event has any Papic photos;
 * the link streams the PDF from the magazine route (couple-gated). No share
 * affordance by design — Variant B (shareable) is a separate gated pipeline.
 */
export async function MagazineCard({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const [{ count: seat }, { count: guest }, { count: kwentos }] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    supabase
      .from('papic_guest_captures')
      .select('capture_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null),
    supabase
      .from('photo_messages')
      .select('message_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'approved'),
  ]);
  const photos = (seat ?? 0) + (guest ?? 0);
  if (photos === 0) return null;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <BookHeart aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
        Kwento Magazine
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Your day as a keepsake magazine — {photos} {photos === 1 ? 'photo' : 'photos'}
        {kwentos ? ` and ${kwentos} ${kwentos === 1 ? 'kwento' : 'kwentos'} from your guests` : ''},
        in the order it all happened. Free, just for the two of you.
      </p>
      <a
        href={`/dashboard/${eventId}/studio/papic/magazine`}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        <BookHeart aria-hidden className="h-4 w-4" strokeWidth={2} />
        Download your magazine (PDF)
      </a>
      <p className="mt-2 text-xs text-ink/45">
        Para sa inyo lang — this private edition shows your photos unblurred. A
        shareable edition arrives with the privacy-screened pipeline.
      </p>
    </section>
  );
}
