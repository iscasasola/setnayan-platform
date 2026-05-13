import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS, RSVP_LABELS } from '@/lib/guests';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { reissueGuestToken, updateEventSlug } from './actions';

export const metadata = { title: 'Invitations' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    reissued?: string;
    slug_saved?: string;
    slug_error?: string;
  }>;
};

const SLUG_ERROR_COPY: Record<string, string> = {
  invalid_format:
    'Slugs must be 3–32 characters: lowercase letters, numbers, and hyphens only.',
  taken: 'That slug is already taken by another event.',
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
    .select('event_id, public_id, display_name, event_date, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const guests = await fetchGuestsByEvent(supabase, eventId);

  // Render QR thumbnails server-side. ~15 guests × ~5KB SVG = fine for V1.
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

  // Public landing URL for the event.
  const publicLandingUrl = event.slug
    ? `${appUrl}/${event.slug}`
    : null;

  const slugAction = updateEventSlug.bind(null, eventId);

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

        <form action={slugAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="slug" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 sm:mr-2">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            defaultValue={event.slug ?? ''}
            placeholder="maria-and-juan"
            pattern="[a-z0-9-]{3,32}"
            className="input-field flex-1 font-mono text-sm"
          />
          <button type="submit" className="button-secondary">
            Save slug
          </button>
        </form>
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
        <p className="mt-2 text-xs text-ink/50">
          3–32 chars · lowercase letters, numbers, hyphens. Changes redirect old links for 90 days.
        </p>
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
