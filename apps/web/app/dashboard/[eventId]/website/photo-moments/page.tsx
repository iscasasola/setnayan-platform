import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { parsePhotoMomentsConfig } from './actions';
import { PhotoMomentsEditor } from './_components/photo-moments-editor';

export const metadata = { title: 'Photo moments' };

/**
 * /dashboard/[eventId]/website/photo-moments — Photo Moments editor.
 *
 * Host edits the phone-down moments list shown on their public landing
 * page at /[slug]. Replaces the previously-hardcoded sample list
 * (Ceremony · The Bridal Walk · etc.) baked into PhotoMomentsWidget on
 * apps/web/app/[slug]/page.tsx.
 *
 * One row per moment (up to 8): time label · title · note · mode. Mode
 * picks one of three visual treatments on the landing page —
 *   • camera_ok: guests welcome to shoot
 *   • phone_down: please put phones down
 *   • papic_only: reserved for the Papic team (iteration 0012)
 *
 * Server-side WHY: the JSONB column on events.photo_moments_config is
 * the storage; this page renders the current shape via
 * parsePhotoMomentsConfig (which degrades gracefully to empty defaults
 * on a malformed row). The client component PhotoMomentsEditor owns
 * the interactive list state — add row, remove row, reorder, save.
 *
 * Entry points (orphan-prevention per memory rule):
 *   • /dashboard/[eventId]/website hub Quick Actions tile (Edit photo
 *     moments) → routes here.
 *   • Direct URL only — no other surface points at this route.
 */
export default async function PhotoMomentsEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug, photo_moments_config')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const config = parsePhotoMomentsConfig(event.photo_moments_config);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to wedding website
        </Link>
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Photo moments
          </p>
          <h1 className="font-serif text-3xl italic tracking-tight sm:text-4xl">
            {event.display_name}
          </h1>
        </div>
        <p className="max-w-prose text-base text-ink/70">
          Tell guests when to enjoy the moment phone-down · when to capture freely · and
          which beats your Papic team will own. Up to 8 entries, displayed in order on
          your landing page.
        </p>
      </header>

      <PhotoMomentsEditor eventId={eventId} initial={config} />

      <footer className="rounded-xl border border-ink/10 bg-cream/60 p-5 text-sm text-ink/65">
        Changes go live the moment you save. Guests will see the new list on their next
        visit to your wedding URL.
      </footer>
    </section>
  );
}
