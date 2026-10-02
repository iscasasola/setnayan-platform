import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { ArrowRight, QrCode } from 'lucide-react';
import { renderStyledUrlQrSvg } from '@/lib/qr';
import { QR_LOOK_COLUMNS, qrLookFromRow } from '@/lib/qr-look.server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { INVITE_THEMES, resolveInviteTheme } from '@/lib/invite-themes';
import { resolveProfile } from '@/lib/event-type-profile';
import { QrActions } from '@/app/_components/qr-actions';
import { svgDataUri } from '@/lib/qr-download';
import { InviteLink } from './invite-link';
import { CopyButton } from '@/app/_components/copy-button';
import { buildGroupInviteMessage } from '@/lib/guest-invite-message';
import { RegenerateQrButton } from './regenerate-qr-button';
import { readWhoCanRsvp } from '@/lib/rsvp-ask';
import { GUESTS_GET_IN_LABEL, guestsGetInLabel, readGuestsGetIn } from '@/lib/who-can-reply';

/**
 * invite-panel.tsx — the invite link, its QR, and the look it opens in. ONE
 * panel, rendered by TWO doors:
 *
 *   /dashboard/[eventId]/guests/invite    the invite page (sidebar, journey,
 *                                         phone header and empty list link here)
 *   /dashboard/[eventId]/guests?gview=share   the guest list's Share the link tab
 *
 * ⚖ Owner 2026-09-21: *"pressing buttons inside the guest list should not
 * clear the whole page. only the body."* Measured on the live page: switching
 * Roster ↔ Wedding March kept the same header element on screen, but Share the
 * link removed the whole guest page 185ms after the click — it was a LINK to
 * another page dressed as a tab. It is a tab now, and this is what it shows.
 *
 * ── MOVED VERBATIM, NOT REWRITTEN ──────────────────────────────────────────
 * The reads and the markup below are the invite page's own text, so every rule
 * they carry comes with them unchanged: the link is built only once it can
 * actually be OPENED (a private event hands out a QR that answers "Link not
 * found"), the "not ready" notice names the real reason, the Pro looks are
 * offered only on weddings, and a zero-row save says it did not save.
 *
 * 🔒 THE COUPLE CHECK TRAVELS WITH IT. The invite page is couple-only — anyone
 * else is sent back to the dashboard. The guest list is not necessarily
 * couple-only, and this panel holds REGENERATE, which kills the current link and
 * every printed QR. So it asks for itself, and a non-couple viewer gets a note —
 * never the button. It returns rather than redirects: a panel must not throw the
 * host off the page it sits in.
 */
export async function InvitePanel({
  eventId,
}: {
  eventId: string;
}) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: membership } = user
    ? await supabase
        .from('event_members')
        .select('member_type')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('member_type', 'couple')
        .maybeSingle()
    : { data: null };
  if (!membership) {
    return (
      <div className="mt-6 rounded-xl border border-ink/10 bg-ink/[0.02] p-6 text-center text-sm text-ink/70">
        Only the couple can share the invite link.
      </div>
    );
  }

  // How the invite looks (lib/invite-themes.ts). Read through the ADMIN client,
  // after the couple check above: a session select that named a column without
  // its per-column grant would refuse the WHOLE events query and blank this page.
  const lookAdmin = createAdminClient();
  const [{ data: lookRow, error: lookError }, ownsPro] = await Promise.all([
    // + the QR look's columns (lib/qr-look.server.ts): the join-link code below
    // wears the event's look, and Pro is already measured on this same read.
    lookAdmin.from('events').select(`invite_theme, event_type, ${QR_LOOK_COLUMNS}`).eq('event_id', eventId).maybeSingle(),
    eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId).catch(() => false),
  ]);
  if (lookError) {
    // Graceful: the picker falls back to House and the page still works — but the
    // failure is logged, so "no theme saved" and "could not read it" never look alike.
    logQueryError('GuestInvitePage (events.invite_theme)', lookError, { event_id: eventId }, 'graceful_degrade');
  }
  /* 🎨 The theme guests meet — read here, CHOSEN in the Event Hub Maker's
     Details (owner 2026-09-28: *"it should not be inside guestlist, it should
     be on event hub maker on details"*). The one theme rule, so this line and
     the door can never name two different looks. */
  const liveTheme = resolveInviteTheme({ saved: lookRow?.invite_theme ?? null, ownsPro });

  const [tokenRes, pendingRes, eventRes, askRes] = await Promise.all([
    supabase
      .from('event_join_tokens')
      .select('token, revoked_at, expires_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    // Unlisted joiners waiting to be reconciled (the Confirm stage) — Invite/Join
    // v2: real guest rows optimistically admitted whose name didn't match.
    supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('entry_source', 'self_added_unlisted')
      .is('deleted_at', null),
    supabase
      .from('events')
      // + the words the group-chat message names the event with.
      .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at, display_name, event_date, event_date_precision')
      .eq('event_id', eventId)
      .maybeSingle(),
    // "Who can RSVP?" — its own read, so a refusal here can never take the
    // invite link down with it.
    supabase
      .from('events')
      .select('rsvp_ask_config')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (tokenRes.error) {
    logQueryError(
      'GuestInvitePage (event_join_tokens)',
      tokenRes.error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  // ⚠ CAN THIS LINK ACTUALLY BE OPENED? Until 2026-08-10 this page printed the
  // QR from the slug alone. On a PRIVATE event both doors refuse — the branded
  // /{slug}/invite page and the opaque /join token action alike — so the host
  // was handed a code that answers "Link not found" to every guest, with no
  // explanation. See lib/shared-join-link.ts.
  const inviteLink = sharedJoinLinkState({
    event: (eventRes.data ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid:
      !!tokenRes.data?.token &&
      !(tokenRes.data as { revoked_at?: string | null }).revoked_at &&
      (!(tokenRes.data as { expires_at?: string | null }).expires_at ||
        new Date((tokenRes.data as { expires_at: string }).expires_at) > new Date()),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Branded invite link when the event has a public slug (e.g. /cale-ice/invite) —
  // the /[slug]/invite route resolves the token server-side, so it stays out of
  // the shared URL + QR. Fall back to the opaque token URL otherwise.
  const slug = (eventRes.data?.slug as string | null) ?? null;
  // Nested /u/ under the cutover flag, bare root otherwise (self-noops OFF).
  const ownerSlug = slug ? await resolveEventOwnerSlug(createAdminClient(), eventId) : null;
  // ⚠ GATED ON `usable`, NOT ON THE SLUG. A slug is a NAME, handed out at
  // creation; it says nothing about whether a guest opening the link sees
  // anything. Building the URL behind the check means there is no dead link in
  // scope to accidentally render later.
  const joinUrl = !inviteLink.usable
    ? null
    : slug
      ? `${appUrl}${publicEventPath(slug, ownerSlug)}/invite`
      : tokenRes.data?.token
        ? `${appUrl}/join/${eventId}?token=${tokenRes.data.token}`
        : null;
  const pendingClaims = pendingRes.count ?? 0;
  if (askRes.error) {
    logQueryError('GuestInvitePage (events.rsvp_ask_config)', askRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const whoCanRsvp = askRes.error ? null : readWhoCanRsvp(askRes.data?.rsvp_ask_config);
  // The whole setting, in Your info's own words (one dropdown there, shown here).
  const getIn = askRes.error ? null : guestsGetInLabel(readGuestsGetIn(askRes.data?.rsvp_ask_config));


  // SVG QR of the join link — a guest scans this, so it wears the event's look
  // (lib/qr-look.ts: the Setnayan mark for a free event, the couple's own on
  // Event Hub Pro) at level H, like every other guest code. Inline, no client JS.
  const qrSvg = joinUrl ? await renderStyledUrlQrSvg(joinUrl, qrLookFromRow(lookRow, ownsPro), 320) : null;

  /* 💬 THE GROUP-CHAT MESSAGE for this ONE shared link (owner 2026-09-29) —
     "…Tap the link, reply with your full name, and we'll confirm you." It is
     the shared link, never a personal key, so it promises no QR: a person who
     arrives by it lands in Requests until the couple Links or Accepts them
     (DECISION_LOG 2026-09-26 "NOBODY WITHOUT A KEY GETS INSIDE"). Same builder
     as every personal message (lib/guest-invite-message.ts). */
  const profile = await resolveProfile((lookRow?.event_type as string | null) ?? 'wedding');
  const ev = (eventRes.data ?? {}) as {
    display_name?: string | null;
    event_date?: string | null;
    event_date_precision?: string | null;
  };
  const groupMessage = joinUrl
    ? buildGroupInviteMessage({
        joinUrl,
        hostsName: ev.display_name ?? null,
        eventWord: profile.terminology.eventWord,
        solemn: profile.terminology.register === 'solemn',
        eventDate: ev.event_date ?? null,
        datePrecision: ev.event_date_precision ?? null,
      })
    : null;

  return (
    <>
      {/* ✉ EACH GUEST THEIR OWN — the personal-link run (owner 2026-09-29).
          The shared link below is for a group chat; this is for sending each
          guest their own link and QR, one by one, from the couple's phone. */}
      <Link
        href={`/dashboard/${eventId}/guests/send`}
        data-send-one-by-one=""
        className="group mt-6 flex min-h-[56px] items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-cream"
      >
        <span className="text-sm">
          <span className="block font-semibold">Send invites one by one</span>
          <span className="block text-cream/75">Each guest gets their own link and QR, from your phone.</span>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
      </Link>

      {joinUrl && inviteLink.usable ? (
        <div className="mt-6 rounded-xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {qrSvg ? (
              <div
                className="qr-slot shrink-0 rounded-xl bg-cream p-3 shadow-inner [&>svg]:h-40 [&>svg]:w-40"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : null}
            <div className="w-full flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/50">
                  Your invite link
                </p>
                <InviteLink url={joinUrl} />
                <QrActions
                  hideCopy
                  url={joinUrl}
                  download={qrSvg ? { href: svgDataUri(qrSvg), filename: 'setnayan-guest-invite-qr.svg' } : null}
                  className="mt-2 flex flex-wrap items-center gap-2"
                />
              </div>
              <p className="text-xs leading-relaxed text-ink/55">
                Send it by text, email, or your group chat — or let guests scan the QR on a
                printed invite. The same link works for everyone.
              </p>
              {groupMessage ? (
                <div className="space-y-2 rounded-lg bg-ink/[0.04] p-3" data-group-invite-message="">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/50">For a group chat</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/85">{groupMessage}</p>
                  <CopyButton value={groupMessage} label="Copy message" copiedLabel="Copied ✓" />
                </div>
              ) : null}
              <div className="border-t border-ink/10 pt-3">
                <RegenerateQrButton eventId={eventId} />
                <p className="mt-1.5 text-xs leading-relaxed text-ink/45">
                  Shared the link too widely, or want to shut off an old printed QR? Regenerate to
                  get a fresh one — the previous link stops working.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ⚠ "TRY AGAIN IN A MOMENT" WAS THE WRONG ADVICE FOR THE COMMONEST CASE.
           This branch used to say the link "isn't ready yet… your event may
           still be setting up" no matter WHY it was missing — so a host whose
           event is private was told to wait for something that would never
           happen, while the QR they already handed out answered "Link not
           found" to every guest. `inviteLink.notice` names the real reason and
           the thing they can change; the old wording survives only as the
           genuine unknown case. */
        <div className="mt-6 rounded-xl border border-ink/10 bg-ink/[0.02] p-6 text-center sm:p-8">
          <p className="mx-auto max-w-prose text-sm text-ink/70">
            {inviteLink.notice ??
              'Your invite link isn’t ready yet. Try again in a moment — if it keeps not showing, your event may still be setting up.'}
          </p>
          {inviteLink.state === 'private' ? (
            <Link
              href={`/dashboard/${eventId}/website`}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-xs font-medium text-cream hover:bg-mulberry-600"
            >
              Open your Event Hub settings
            </Link>
          ) : null}
        </div>
      )}

      {/* 🗳 HOW GUESTS GET IN — the SAME stored setting Your info's one dropdown
          sets (`events.rsvp_ask_config`, read through `readWhoCanRsvp` /
          `readGuestsGetIn`). Shown here, changed there (owner 2026-10-02, "ONE
          HOME, MAPPED": the Guest list may show it, never set it): this panel
          has no writer of its own. A read that failed says so. */}
      <Link
        href={`/dashboard/${eventId}/launch?tool=rsvp-page`}
        data-invite-who-can-rsvp={whoCanRsvp ?? 'unknown'}
        className="mt-4 flex min-h-11 items-center justify-between gap-3 border-b border-ink/10 py-2 text-sm text-ink hover:text-ink/80"
      >
        <span>
          <span className="font-semibold">{GUESTS_GET_IN_LABEL}</span>{' '}
          <span className="text-ink/70">{getIn ?? 'We couldn’t read this just now'}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-ink/55">Change in Your info</span>
      </Link>

      {pendingClaims > 0 ? (
        <Link
          href={`/dashboard/${eventId}/guests/claims`}
          className="group mt-4 flex items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/10"
        >
          <span className="text-sm text-ink">
            <span className="font-semibold text-terracotta-700">
              {pendingClaims} {pendingClaims === 1 ? 'request' : 'requests'}
            </span>{' '}
            waiting for you to confirm
          </span>
          <ArrowRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-terracotta/60 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </Link>
      ) : null}

      {/* 🎨 THE ONE THEME LINE — never a picker. One place chooses the theme
          (Event Hub Maker → Details); every other surface reads it. */}
      <p data-invite-theme-line="" className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-ink/75">
        <span>Theme</span>
        <b className="font-semibold text-ink">{INVITE_THEMES[liveTheme].name}</b>
        <span aria-hidden>·</span>
        <Link
          href={`/dashboard/${eventId}/launch?tool=details&item=theme`}
          className="font-medium text-link underline-offset-2 hover:underline"
        >
          Change in Event Hub Maker ↗
        </Link>
      </p>

      {/* Event QR (crew pairing) — a DIFFERENT QR from the guest invite above.
          This one pairs your photo + livestream vendors' capture DEVICES to the
          event; it is NOT a guest invite. The Event QR tool (/event-qr) was
          orphaned when the Home/Overview redesigns dropped its tile, so this
          quiet secondary row gives it one findable home (2026-07-15). */}
      <Link
        href={`/dashboard/${eventId}/event-qr`}
        className="group mt-4 flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3 transition-colors hover:border-ink/20 hover:bg-ink/[0.04]"
      >
        <span className="flex items-start gap-2.5 text-sm text-ink/70">
          <QrCode
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-ink/45"
            strokeWidth={1.75}
          />
          <span>
            <span className="font-medium text-ink">Event QR for your crew</span> — pairs
            your photo &amp; livestream vendors&rsquo; devices to this event. Not for
            guest invites.
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </Link>
    </>
  );
}
