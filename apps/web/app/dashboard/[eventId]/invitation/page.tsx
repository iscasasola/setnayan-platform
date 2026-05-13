import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS, RSVP_LABELS } from '@/lib/guests';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { deriveMonogram, resolveMonogram } from '@/lib/monogram';
import { reissueGuestToken, updateEventSlug, updateMonogram } from './actions';
import { SlugField } from './_components/slug-field';

export const metadata = { title: 'Invitations' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    reissued?: string;
    slug_saved?: string;
    slug_error?: string;
    mono_saved?: string;
    mono_error?: string;
  }>;
};

const SLUG_ERROR_COPY: Record<string, string> = {
  invalid_format:
    'Slugs must be 3–32 characters: lowercase letters, numbers, and hyphens only.',
  taken: 'That slug is already taken by another event.',
};

const MONO_ERROR_COPY: Record<string, string> = {
  invalid_color: 'Monogram color must be a hex code like #C97B4B.',
};

export default async function InvitationAdminPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, slug, monogram_text, monogram_color',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const guests = await fetchGuestsByEvent(supabase, eventId);

  const monogram = resolveMonogram(event);

  // Render QR thumbnails server-side with monogram composited in the center.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const qrEntries = await Promise.all(
    guests.map(async (g) => ({
      guestId: g.guest_id,
      url: buildInvitationUrl({ appUrl, slug: event.slug ?? eventId, qrToken: g.qr_token }),
      svg: await renderInvitationQrSvg({
        appUrl,
        slug: event.slug ?? eventId,
        qrToken: g.qr_token,
        monogram,
      }),
    })),
  );
  const qrByGuest = new Map(qrEntries.map((e) => [e.guestId, e]));

  const reissuedGuestId = search.reissued ?? null;
  const slugSaved = search.slug_saved === '1';
  const slugErrorKey = search.slug_error ?? null;
  const slugError = slugErrorKey
    ? (SLUG_ERROR_COPY[slugErrorKey] ?? decodeURIComponent(slugErrorKey))
    : null;

  const monoSaved = search.mono_saved === '1';
  const monoErrorKey = search.mono_error ?? null;
  const monoError = monoErrorKey
    ? (MONO_ERROR_COPY[monoErrorKey] ?? decodeURIComponent(monoErrorKey))
    : null;

  // Public landing URL for the event.
  const publicLandingUrl = event.slug
    ? `${appUrl}/${event.slug}`
    : null;

  const slugAction = updateEventSlug.bind(null, eventId);
  const monoAction = updateMonogram.bind(null, eventId);

  // Render a single preview-size QR using the first guest's token so the
  // couple can see exactly what their guests' QRs look like with the
  // current monogram + color.
  const previewGuest = guests[0];
  const previewQrSvg = previewGuest
    ? await renderInvitationQrSvg({
        appUrl,
        slug: event.slug ?? eventId,
        qrToken: previewGuest.qr_token,
        monogram,
      })
    : null;
  const defaultDerived = deriveMonogram(event.display_name);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Invitation site
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {guests.length} guest{guests.length === 1 ? '' : 's'} · QRs &amp; print sheet
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${eventId}/invitation/print`}
            className="button-secondary"
            target="_blank"
          >
            Print sheet (A4)
          </Link>
        </div>
      </header>

      {reissuedGuestId ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Token rotated. The previously-printed QR for this guest is now invalid — reprint
          and re-send their card.
        </p>
      ) : null}

      {/* Branding: monogram in QR center + hero */}
      <section className="rounded-xl border border-ink/10 bg-cream p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              Branding
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Your monogram</h2>
            <p className="mt-1 text-sm text-ink/60">
              Appears in the center of every guest&rsquo;s QR + on the hero of their personal
              invitation page.
            </p>
          </div>
          {previewQrSvg ? (
            <div
              aria-label="QR preview with monogram"
              className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-white p-2"
              dangerouslySetInnerHTML={{ __html: previewQrSvg }}
            />
          ) : null}
        </header>

        <form action={monoAction} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1.5">
            <label htmlFor="monogram_text" className="block text-sm font-medium text-ink">
              Monogram text
            </label>
            <input
              id="monogram_text"
              name="monogram_text"
              defaultValue={event.monogram_text ?? ''}
              maxLength={12}
              placeholder={defaultDerived}
              className="input-field font-serif text-base italic"
            />
            <p className="text-xs text-ink/50">
              Defaults to <code className="font-mono">{defaultDerived}</code> from your
              event name. Up to 12 characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="monogram_color" className="block text-sm font-medium text-ink">
              Color
            </label>
            <input
              id="monogram_color"
              name="monogram_color"
              type="color"
              defaultValue={event.monogram_color ?? '#C97B4B'}
              className="h-11 w-20 cursor-pointer rounded-md border border-ink/15 bg-cream p-1"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="button-primary w-full sm:w-auto">
              Save monogram
            </button>
          </div>
        </form>

        {monoError ? (
          <p role="alert" className="mt-3 text-xs text-terracotta-700">
            {monoError}
          </p>
        ) : null}
        {monoSaved ? (
          <p role="status" className="mt-3 text-xs text-emerald-700">
            Monogram saved. Every guest&rsquo;s QR + invitation page now uses your new branding.
          </p>
        ) : null}
      </section>

      {/* Public URL + slug editor */}
      <section className="rounded-xl border border-ink/10 bg-cream p-5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
          Your public landing
        </p>
        {publicLandingUrl ? (
          <p className="mt-2">
            <Link
              href={publicLandingUrl}
              target="_blank"
              className="break-all font-mono text-sm text-terracotta underline-offset-4 hover:underline"
            >
              {publicLandingUrl}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink/60">No slug set yet.</p>
        )}

        <div className="mt-4">
          <SlugField
            eventId={eventId}
            initialSlug={event.slug ?? ''}
            saveAction={slugAction}
          />
        </div>
        {slugError ? (
          <p role="alert" className="mt-2 text-xs text-terracotta-700">
            {slugError}
          </p>
        ) : null}
        {slugSaved ? (
          <p role="status" className="mt-2 text-xs text-emerald-700">
            Slug saved.
          </p>
        ) : null}
      </section>

      {/* Guest table */}
      <div className="hidden overflow-hidden rounded-xl border border-ink/10 sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-4 py-3 font-medium">QR</th>
              <th className="px-3 py-3 font-medium">Guest</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">RSVP</th>
              <th className="px-3 py-3 font-medium">Personal URL</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => {
              const qr = qrByGuest.get(guest.guest_id);
              const reissueAction = reissueGuestToken.bind(null, eventId, guest.guest_id);
              return (
                <tr key={guest.guest_id} className="border-t border-ink/5 align-top">
                  <td className="px-4 py-3">
                    <div
                      aria-label={`QR for ${guestDisplayName(guest)}`}
                      className="inline-block h-16 w-16 overflow-hidden rounded bg-white p-1"
                      dangerouslySetInnerHTML={{ __html: qr?.svg ?? '' }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
                      className="font-medium text-ink hover:text-terracotta"
                    >
                      {guestDisplayName(guest)}
                    </Link>
                    <p className="text-xs text-ink/55">{guest.email ?? guest.mobile ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-ink/70">{ROLE_LABELS[guest.role]}</td>
                  <td className="px-3 py-3 text-ink/70">{RSVP_LABELS[guest.rsvp_status]}</td>
                  <td className="px-3 py-3">
                    <code className="block break-all font-mono text-[10px] leading-relaxed text-ink/60">
                      {qr?.url}
                    </code>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <form action={reissueAction} className="inline">
                      <button
                        type="submit"
                        className="text-sm text-terracotta-700 underline-offset-4 hover:underline"
                      >
                        Re-issue
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="space-y-3 sm:hidden">
        {guests.map((guest) => {
          const qr = qrByGuest.get(guest.guest_id);
          const reissueAction = reissueGuestToken.bind(null, eventId, guest.guest_id);
          return (
            <li
              key={guest.guest_id}
              className="space-y-3 rounded-lg border border-ink/10 bg-cream p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  aria-label={`QR for ${guestDisplayName(guest)}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded bg-white p-1"
                  dangerouslySetInnerHTML={{ __html: qr?.svg ?? '' }}
                />
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
                    className="font-medium text-ink hover:text-terracotta"
                  >
                    {guestDisplayName(guest)}
                  </Link>
                  <p className="text-xs text-ink/55">{ROLE_LABELS[guest.role]}</p>
                  <p className="text-xs text-ink/55">RSVP: {RSVP_LABELS[guest.rsvp_status]}</p>
                </div>
              </div>
              <form action={reissueAction}>
                <button
                  type="submit"
                  className="text-sm text-terracotta-700 underline-offset-4 hover:underline"
                >
                  Re-issue token
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
