import Link from 'next/link';
import { ArrowRight, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { suggestedInviteTheme } from '@/lib/invite-themes';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import type { InviteReturn } from '@/lib/invite-return';
import { QrActions } from '@/app/_components/qr-actions';
import { svgDataUri } from '@/lib/qr-download';
import { InviteLink } from './invite-link';
import { InviteThemePicker } from './invite-theme-picker';
import { RegenerateQrButton } from './regenerate-qr-button';

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
  themeNotice,
  returnTo,
}: {
  eventId: string;
  /** `?theme=saved|error` from the last look save, read by the host page. */
  themeNotice: 'saved' | 'error' | null;
  /** Which door this panel is rendered by, so saving a look returns there. */
  returnTo: InviteReturn;
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
    lookAdmin.from('events').select('invite_theme, mood_feel_key, event_type').eq('event_id', eventId).maybeSingle(),
    eventCoupleWebsiteProActive(lookAdmin, eventId).catch(() => false),
  ]);
  if (lookError) {
    // Graceful: the picker falls back to House and the page still works — but the
    // failure is logged, so "no theme saved" and "could not read it" never look alike.
    logQueryError('GuestInvitePage (events.invite_theme)', lookError, { event_id: eventId }, 'graceful_degrade');
  }
  /*
    🔒 WEDDINGS ONLY (owner Q7 = A, 2026-09-11). The Pro themes are offered only
    where the event type may carry the Save-the-Date film — the reveal's own
    fence, `resolveWeddingOnlyParts(profile).save_the_date_film`, asked here so a
    birthday is never shown four radios that `setInviteTheme` would refuse. An
    unreadable profile is NOT a wedding: the `.catch` falls to the free door
    rather than opening a paid one.
  */
  const mayShowStdFilm = await resolveProfile((lookRow?.event_type as string | null) ?? '')
    .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
    .catch(() => false);
  const selectedTheme = suggestedInviteTheme({
    saved: lookRow?.invite_theme ?? null,
    moodFeelKey: lookRow?.mood_feel_key ?? null,
    ownsPro,
    mayShowStdFilm,
  });

  const [tokenRes, pendingRes, eventRes] = await Promise.all([
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
      .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
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


  // SVG QR of the join link — crisp at any size, ~3KB inline, no client JS.
  const qrSvg = joinUrl
    ? await QRCode.toString(joinUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#1B1A17', light: '#FBFBFA' },
      })
    : null;

  return (
    <>
      {joinUrl && inviteLink.usable ? (
        <div className="mt-6 rounded-xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {qrSvg ? (
              <div
                className="shrink-0 rounded-xl bg-cream p-3 shadow-inner [&>svg]:h-40 [&>svg]:w-40"
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

      <InviteThemePicker
        eventId={eventId}
        selected={selectedTheme}
        ownsPro={ownsPro}
        mayShowStdFilm={mayShowStdFilm}
        /* Both outcomes reach the screen. `?theme=error` used to render
           nothing at all, so a refused save looked like a page that had simply
           been reloaded. */
        notice={themeNotice}
        returnTo={returnTo}
      />

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
