import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchGuestsByEvent, guestDisplayName, guestRoleLabel, RSVP_LABELS } from '@/lib/guests';
import { loadRoleNames } from '@/lib/role-names.server';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { QR_LOOK_COLUMNS, resolveEventQrLook } from '@/lib/qr-look.server';
import { publicEventUrl, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { deriveMonogram, resolveMonogram } from '@/lib/monogram';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { SLUG_CONFLICT_MESSAGE } from '@/lib/slug-availability';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  markGuestInvitationSent,
  reissueGuestToken,
  updateEventSlug,
  updateMonogram,
} from './actions';
import { GuestInviteModal } from './_components/guest-invite-modal';
import { buildGuestInviteMessage } from '@/lib/guest-invite-message';
import { loadInviteSetup } from '../guests/_components/invite-message-setup';
import { SlugField } from './_components/slug-field';
import { ReissueQrButton } from './_components/reissue-qr-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { QrActions } from '@/app/_components/qr-actions';
import { qrFileName } from '@/lib/qr-download';
import { TagListDownload } from '@/app/_components/tag-list-download';
import { invitationReach, unreachableSentence } from '@/lib/invitation-reach';
import { formatCount } from '@/lib/format-number';

export const metadata = { title: 'Invitations' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    reissued?: string;
    reissue_error?: string;
    slug_saved?: string;
    slug_error?: string;
    mono_saved?: string;
    mono_error?: string;
  }>;
};

// One refusal reason, one sentence — sourced from the availability module so a
// reason added there can never arrive here with no copy and render as its own
// bare key ("forwarding"). A refusal nobody can read is a refusal in silence.
const SLUG_ERROR_COPY: Record<string, string> = {
  ...SLUG_CONFLICT_MESSAGE,
  taken: 'That address is already taken by another event.',
};

const MONO_ERROR_COPY: Record<string, string> = {
  invalid_color: 'Monogram color must be a hex code like #C97B4B.',
};

export default async function InvitationAdminPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  // The couple's own words for roles (owner 2026-09-30).
  const roleNames = await loadRoleNames(supabase, eventId, 'InvitationAdminPage.roleNames');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      /* `venue_name` left this read on 2026-09-29: the per-guest message is the
         owner's shorter one now (name · event · date · their link · their QR)
         and names no venue — its facts come from `loadInviteSetup`, shared with
         the guest list's Send invite. */
      // + the CANONICAL monogram list and the QR look's two columns
      // (lib/qr-look.server.ts) — every code on this page wears the event's look.
      `event_id, public_id, event_date, slug, ${QR_LOOK_COLUMNS}`,
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event record. Degrades rather than claiming.
  if (eventError) {
    logQueryError('InvitationPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) redirect(`/dashboard/${eventId}`);

  const [guests, inviteSetup] = await Promise.all([
    fetchGuestsByEvent(supabase, eventId),
    /* The ONE message builder's inputs — the event's words and the couple's own
       wording — shared with the guest list's Send invite (2026-09-29). */
    loadInviteSetup(supabase, eventId),
  ]);
  /* Counted from the rows already in hand — no second query for a number the
     page has already read. */
  const invitationsMarked = guests.filter((g) => g.invitation_sent_at !== null).length;
  const unreachableLine = unreachableSentence(invitationReach(guests));

  const monogram = resolveMonogram(event);

  // THE LOOK every code on this page wears (owner 2026-09-27, lib/qr-look.ts):
  // the Setnayan mark in the centre for a free event; the couple's own logo,
  // shape, pattern and palette ink on Event Hub Pro. The old "Custom QR per
  // guest" product (palette-tinted modules behind its own SKU) folded into Pro,
  // so there is no second branch here any more — one look, one renderer.
  //
  // Resolved with the ADMIN client: Pro is an EVENT-level fact, but `orders`
  // RLS is purchaser-scoped, so a co-host who didn't personally place the order
  // would otherwise be shown the free look. The !event redirect above is the
  // membership authorization. A failed read degrades to the free look.
  const look = await resolveEventQrLook(createAdminClient(), eventId, event);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Canonical URL form for the printed/shared QRs — nested /u/ under the cutover
  // flag, bare root otherwise (resolve self-noops OFF; no query pre-cutover).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const qrEntries = await Promise.all(
    guests.map(async (g) => ({
      guestId: g.guest_id,
      url: buildInvitationUrl({ appUrl, slug: event.slug ?? eventId, qrToken: g.qr_token, ownerSlug }),
      svg: await renderInvitationQrSvg({
        appUrl,
        slug: event.slug ?? eventId,
        qrToken: g.qr_token,
        look,
        ownerSlug,
      }),
    })),
  );
  const qrByGuest = new Map(qrEntries.map((e) => [e.guestId, e]));
  const nameByGuest = new Map(guests.map((g) => [g.guest_id, guestDisplayName(g)]));

  const reissuedGuestId = search.reissued ?? null;
  const reissueError = search.reissue_error ?? null;

  // Build ④ rotation metadata — read defensively: the qr_token_rotated_at
  // column lands with migration 20270917400000; before it applies (or on any
  // read error) this map is simply empty and the page renders as before.
  const rotatedAtByGuest = new Map<string, string>();
  try {
    const { data: rotatedRows, error: rotatedRowsError } = await createAdminClient()
      .from('guests')
      .select('guest_id, qr_token_rotated_at')
      .eq('event_id', eventId)
      .not('qr_token_rotated_at', 'is', null);
    // ⚠ guests whose invite links were rotated. Refused, the page reads as though none
    // ⚠ were, which is a claim about who can still get in.
    if (rotatedRowsError) {
      logQueryError('InvitationPage.rotatedRows', rotatedRowsError, { eventId }, 'graceful_degrade');
    }
    for (const r of rotatedRows ?? []) {
      if (r.qr_token_rotated_at) rotatedAtByGuest.set(r.guest_id, r.qr_token_rotated_at);
    }
  } catch {
    // pre-migration / degraded read — no badges, nothing else changes
  }

  // Live day-of window (T-1h..T+8h): the confirm dialog escalates to a typed
  // confirm — rotating mid-event kills the guest's printed place card and the
  // check-in desk scan within one refresh.
  const dayOfLive = event.event_date ? getDayOfPhase(event.event_date) === 'live' : false;

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
    ? publicEventUrl(appUrl, event.slug, ownerSlug)
    : null;

  const slugAction = updateEventSlug.bind(null, eventId, 'invitation');
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
        look,
        ownerSlug,
      })
    : null;
  const defaultDerived = deriveMonogram(event.display_name);

  return (
    <section className="space-y-6">
      <PageMasthead
        titleNode={
          <>
            {formatCount(guests.length)} guest{guests.length === 1 ? '' : 's'} · QRs &amp; print sheet
          </>
        }
        actions={
          <div className="flex gap-2">
            <Link
              href={`/dashboard/${eventId}/invitation/print`}
              className="button-secondary"
              target="_blank"
            >
              Print sheet (A4)
            </Link>
            {/* A batch of guest tags is a desk job, not 180 taps on a phone. */}
            <TagListDownload
              rows={qrEntries.map((e) => ({
                name: nameByGuest.get(e.guestId) ?? 'Guest',
                url: e.url,
              }))}
              eventName={event.display_name ?? null}
            />
          </div>
        }
      />

      {reissuedGuestId ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          QR replaced. The previously printed QR and every shared link for this guest are now
          invalid — reprint and re-send their card. Their RSVP, seat, and photos are unchanged.
        </p>
      ) : null}

      {reissueError ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Couldn&rsquo;t replace that QR: {reissueError}
        </p>
      ) : null}

      {/* Branding: monogram in QR center + hero */}
      <section className="sn-tile p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="sn-eye">
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
              className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
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
            <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Saving…">
              Save monogram
            </SubmitButton>
          </div>
        </form>

        {monoError ? (
          <p role="alert" className="mt-3 text-xs text-terracotta-700">
            {monoError}
          </p>
        ) : null}
        {monoSaved ? (
          <p role="status" className="mt-3 text-xs text-success-700">
            Monogram saved. Every guest&rsquo;s QR + invitation page now uses your new branding.
          </p>
        ) : null}
      </section>

      {/* Invitation site URL + slug editor */}
      <section className="sn-tile p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="sn-eye">
              Your invitation site
            </p>
            {publicLandingUrl ? (
              <p className="break-all font-mono text-sm text-ink/75">{publicLandingUrl}</p>
            ) : (
              <p className="text-sm text-ink/60">No slug set yet — pick one below.</p>
            )}
          </div>
          {publicLandingUrl ? (
            <Link
              href={publicLandingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              Preview as guest
              <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>

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
          <p role="status" className="mt-2 text-xs text-success-700">
            Slug saved.
          </p>
        ) : null}
      </section>

      {/*
        HOW MANY STILL NEED THEIRS — the question a couple actually has.

        🔑 THIS NUMBER CAN NOW FALL, which is the whole reason it is allowed to
        exist. The guest list's old "N to send" counted the same column while
        NOTHING in the product wrote to it, so it was frozen forever beside
        three siblings whose numbers moved; it was removed rather than faked
        (`lib/the-invite-step-counts-what-is-true.test.ts`). `markGuestInvitationSent`
        is the writer that was missing, so counting is honest again.

        ⚠ It counts what the couple RECORDED, not what any system delivered —
        Setnayan sends none of these. The wording says "marked", never "sent".
      */}
      {/*
        WHO CANNOT BE REACHED AT ALL — CTRL-B4 build 3.

        🔑 A SCREEN THAT REPORTS ONLY "MARKED" IS A LIE OF OMISSION HERE.
        Measured 2026-09-22: 146 guests, 5 with an email, 0 with a mobile only —
        so 141 people cannot be sent anything by any channel. "3 marked" is true
        and useless next to that; the number that decides what the couple does
        next is the one that was missing.

        Rendered immediately beside the marked count on purpose, and asserted
        that way by `the-invitation-says-who-it-cannot-reach.test.ts`, so a
        later change cannot keep one number and quietly drop the other.
      */}
      {guests.length > 0 && unreachableLine ? (
        <p className="mb-2 text-xs text-ink/60">{unreachableLine}</p>
      ) : null}
      {guests.length > 0 ? (
        <p className="mb-2 text-xs text-ink/60">
          {invitationsMarked === 0 ? (
            <>None marked as handed out yet — open <span className="font-medium">Send</span> on a
            row to copy that guest&rsquo;s own message.</>
          ) : invitationsMarked === guests.length ? (
            <>All {formatCount(guests.length)} marked as handed out.</>
          ) : (
            <>
              <span className="font-medium text-ink/80">{formatCount(invitationsMarked)}</span> of {formatCount(guests.length)}{' '}
              marked as handed out &mdash; {formatCount(guests.length - invitationsMarked)} still to go.
            </>
          )}
        </p>
      ) : null}

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
              /* One message per guest, carrying THAT guest's own link. Null when
                 they have no link yet — the modal then offers no Copy button. */
              const inviteMessage = buildGuestInviteMessage({
            ...inviteSetup.facts,
            firstName: guest.first_name,
            guestName: guestDisplayName(guest),
            inviteUrl: qr?.url ?? '',
            template: inviteSetup.template,
          });
              const markSentAction = markGuestInvitationSent.bind(null, eventId, guest.guest_id);
              return (
                <tr key={guest.guest_id} className="border-t border-ink/5 align-top">
                  <td className="px-4 py-3">
                    <div
                      aria-label={`QR for ${guestDisplayName(guest)}`}
                      className="inline-block h-16 w-16 overflow-hidden rounded bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
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
                  <td className="px-3 py-3 text-ink/70">{guestRoleLabel(guest.role, roleNames)}</td>
                  <td className="px-3 py-3 text-ink/70">{RSVP_LABELS[guest.rsvp_status]}</td>
                  <td className="px-3 py-3">
                    <code className="block break-all font-mono text-[10px] leading-relaxed text-ink/60">
                      {qr?.url}
                    </code>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {qr ? (
                        <QrActions
                          url={qr.url}
                          download={{
                            // The same PNG route the guest drawer shows and every
                            // guest surface saves — in the event's look.
                            href: `/api/website/qr/guest/${guest.guest_id}`,
                            filename: qrFileName(guestDisplayName(guest), 'png'),
                            label: 'PNG',
                          }}
                        />
                      ) : null}
                      {/* ⚖ SEND SITS BEFORE RE-ISSUE, and not only for reading order:
                          sending is the ordinary weekly act and re-issuing is the rare
                          repair. The common control goes first. */}
                      <GuestInviteModal
                        guestId={guest.guest_id}
                        guestName={guestDisplayName(guest)}
                        message={inviteMessage}
                        sentAt={guest.invitation_sent_at}
                        markSent={markSentAction}
                      />
                      <ReissueQrButton
                        action={reissueAction}
                        guestName={guestDisplayName(guest)}
                        hasEmail={Boolean(guest.email)}
                        dayOfLive={dayOfLive}
                        rotatedAt={rotatedAtByGuest.get(guest.guest_id) ?? null}
                      />
                    </div>
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
          /* One message per guest, carrying THAT guest's own link. Null when
             they have no link yet — the modal then offers no Copy button. */
          const inviteMessage = buildGuestInviteMessage({
            ...inviteSetup.facts,
            firstName: guest.first_name,
            guestName: guestDisplayName(guest),
            inviteUrl: qr?.url ?? '',
            template: inviteSetup.template,
          });
          const markSentAction = markGuestInvitationSent.bind(null, eventId, guest.guest_id);
          return (
            <li
              key={guest.guest_id}
              className="sn-row space-y-3 p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  aria-label={`QR for ${guestDisplayName(guest)}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr?.svg ?? '' }}
                />
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
                    className="font-medium text-ink hover:text-terracotta"
                  >
                    {guestDisplayName(guest)}
                  </Link>
                  <p className="text-xs text-ink/55">{guestRoleLabel(guest.role, roleNames)}</p>
                  <p className="text-xs text-ink/55">RSVP: {RSVP_LABELS[guest.rsvp_status]}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* ⚖ SEND SITS BEFORE RE-ISSUE, and not only for reading order:
                    sending is the ordinary weekly act and re-issuing is the rare
                    repair. The common control goes first. */}
                <GuestInviteModal
                  guestId={guest.guest_id}
                  guestName={guestDisplayName(guest)}
                  message={inviteMessage}
                  sentAt={guest.invitation_sent_at}
                  markSent={markSentAction}
                />
                <ReissueQrButton
                  action={reissueAction}
                  guestName={guestDisplayName(guest)}
                  hasEmail={Boolean(guest.email)}
                  dayOfLive={dayOfLive}
                  rotatedAt={rotatedAtByGuest.get(guest.guest_id) ?? null}
                />
                {qr ? (
                  <QrActions
                    url={qr.url}
                    download={{
                      href: `/api/website/qr/guest/${guest.guest_id}`,
                      filename: qrFileName(guestDisplayName(guest), 'png'),
                      label: 'Download PNG',
                    }}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
