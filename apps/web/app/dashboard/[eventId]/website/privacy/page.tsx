import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Globe, Lock, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { SubmitButton } from '@/app/_components/submit-button';
import { updateLandingPageVisibility } from './actions';

export const metadata = { title: 'Who can view your wedding page' };

/**
 * /dashboard/[eventId]/website/privacy — landing-page visibility editor.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: hosts need a way to make
 * their wedding landing page private (or restrict who can view it).
 *
 * Three-state picker (Public / Unlisted / Private) — see the migration
 * at `supabase/migrations/20260605050000_events_landing_page_visibility.sql`
 * for the enum + comment. Default is 'public' on every event (V1
 * backwards-compat with the pre-toggle behavior).
 *
 * The actual gate enforcement lives in `apps/web/app/[slug]/page.tsx`:
 * 'public' and 'unlisted' render identically today on the landing page
 * itself; 'private' renders a polite locked screen unless the visitor is
 * authenticated AND tied to the event via event_members, event_moderators,
 * or guests.linked_user_id.
 *
 * Per CLAUDE.md 2026-05-19 row 426 the broader Phase 4 editorial RA 10173
 * guardrails (T+27d reminder email · pseudonymization · private-always
 * field allowlist · right-to-redact · onboarding-time consent checkbox)
 * live in V1.1 iteration 0046 — this PR is the V1 minimum-viable lever.
 */
export default async function PrivacyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, landing_page_visibility',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const currentVisibility = (event.landing_page_visibility ?? 'public') as
    | 'public'
    | 'unlisted'
    | 'private';
  const saved = search.saved === '1';

  return (
    <section className="space-y-8">
      {/* Header strip — back link + title */}
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Back to your wedding website
        </Link>
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Who can view
          </p>
          <h1 className="font-serif text-3xl italic tracking-tight sm:text-4xl">
            Set who can see your wedding page
          </h1>
          <p className="max-w-prose text-base text-ink/70">
            Choose who can view {event.display_name ? <em>{event.display_name}</em> : 'your wedding'} at{' '}
            {event.slug ? (
              <span className="font-mono text-sm">setnayan.com/{event.slug}</span>
            ) : (
              'your wedding URL'
            )}
            . You can change this anytime.
          </p>
        </div>
      </header>

      {/* Saved confirmation — polite + non-dismissible (gone on next nav) */}
      {saved ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>Saved. Your wedding page now follows this setting.</p>
        </div>
      ) : null}

      {/* The picker — three radio cards in a single form */}
      <form action={updateLandingPageVisibility} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />

        <fieldset className="space-y-3">
          <legend className="sr-only">Landing-page visibility</legend>

          <VisibilityCard
            value="public"
            currentValue={currentVisibility}
            icon={<Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Public"
            blurb="Anyone with your wedding's URL can view your landing page. Search engines may index it after your wedding day."
          />

          <VisibilityCard
            value="unlisted"
            currentValue={currentVisibility}
            icon={<EyeOff aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Unlisted"
            blurb="The URL works for anyone you share it with, but your landing page won't be indexed by search engines or surfaced on Setnayan's public pages."
          />

          <VisibilityCard
            value="private"
            currentValue={currentVisibility}
            icon={<Lock aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />}
            title="Private"
            blurb="Only your guests (in your guest list) and your event moderators can view. Anyone else opening the URL sees a polite locked screen."
          />
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
          <Link
            href={`/dashboard/${eventId}/website`}
            className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Back
          </Link>
        </div>
      </form>

      {/* Footnote — light context so the host knows what changes immediately */}
      <footer className="rounded-xl border border-ink/10 bg-cream/60 p-5 text-sm text-ink/65">
        Changes apply right away. Anyone with your URL who already opened the page
        may see the previous view for up to a minute while their browser refreshes.
      </footer>
    </section>
  );
}

/**
 * Single radio card — visually selected when value === currentValue. Hidden
 * native radio for keyboard / a11y; the label is the click target.
 */
function VisibilityCard({
  value,
  currentValue,
  icon,
  title,
  blurb,
}: {
  value: 'public' | 'unlisted' | 'private';
  currentValue: 'public' | 'unlisted' | 'private';
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  const selected = value === currentValue;
  return (
    <label
      className={`group flex cursor-pointer items-start gap-4 rounded-xl border p-5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta ${
        selected
          ? 'border-terracotta bg-white/80 ring-2 ring-terracotta ring-offset-2 ring-offset-cream'
          : 'border-ink/10 bg-cream hover:border-terracotta/40 hover:bg-white/60'
      }`}
    >
      <input
        type="radio"
        name="visibility"
        value={value}
        defaultChecked={selected}
        className="sr-only"
      />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink">{title}</span>
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-terracotta-700">
              <Check aria-hidden className="h-3 w-3" strokeWidth={2} />
              Current
            </span>
          ) : null}
        </span>
        <span className="block text-sm text-ink/70">{blurb}</span>
      </span>
    </label>
  );
}
