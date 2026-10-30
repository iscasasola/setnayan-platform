import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PAPIC_STYLES } from '@/lib/papic-photo-styles';
import { PAPIC_UNTIL_WORDS } from '@/lib/papic-glance';
import { papicDayWords, papicSpanWords } from '@/lib/papic-home-card';
import { GuestContributionsCard } from './guest-contributions-card';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { InfoTip } from '@/app/_components/info-tip';
import { AnswerPicker } from '@/app/dashboard/[eventId]/launch/_components/details-answers';
import { papicChoices, papicIsOn } from '@/lib/event-answers';
import { formatCount } from '@/lib/format-number';
import {
  resolveStoredWindow,
  formatWindowSummary,
  formatPapicDayInWords,
  captureWindowState,
} from '@/lib/papic-window';
import PapicWindowPicker from '../papic-window-picker';
import StylePicker from '../style-picker';
import { CoupleChallengesManager } from '../couple-challenges-manager';
import { VendorChallengesApproval } from '../vendor-challenges-approval';
import { SettingRow } from './setting-row';
import { readShootNow } from './guest-cameras-choice';
import { ShootNowSwitch } from './shoot-now-switch';
import { FaceTaggingChoice } from './face-tagging-choice';
import { FaceBlockingCount } from './face-blocking-count';
import { GuestAllotmentsChoice } from './guest-allotments-choice';

/**
 * papic-camera-settings.tsx — PAPIC, THE CAMERA, IN THE OWNER'S ORDER (owner 2026-10-23: *"Papic holds: Filter,
 * Credits per guest, face tagging, face blocking, challenge"*; approved `prototypes/papic_controller_one_page_2026-10-23.html`):
 *
 *   the one line — Papic [switch] · the dates
 *   (credits: Total · Used · Remaining — when the caller hands them over)
 *   Settings — Filter · Credits per guest · "Each guest's camera is on their guest card ›" · Face tagging · Face blocking
 *   (When guests can shoot is the card's HEAD switch once Papic is on — owner 2026-10-30, `PapicHeadControl` below)
 *   Challenges
 *
 * ONE component, two seats: Home's Papic card draws it UNDER the card when it opens (owner, 23 Oct: *"expanding opens
 * the rest of the settings under it not open a new page"*), and `/studio/papic` draws it for old links. The switch is
 * the event's own `papic_on` answer (the capture gate reads it) — never a second on/off.
 *
 * 👥 EVENT-WIDE SETTINGS, THE SAME ON BOTH SEATS (owner rulings 2026-10-23/24): "Each guest, at most ___" — the
 * event-wide limit — is in the card; each guest card overrides it for one person, and holds their face switches. The
 * seat only decides where a save lands (Home or this page).
 */
const COUNTER_FRAME = 'grid grid-cols-3 overflow-hidden rounded-2xl border border-ink/10 text-center'; // no-card-ok: the approved controller's counter frame (owner 2026-10-24)

export async function PapicCameraSettings({
  eventId,
  credits = null,
  seat = 'page',
  buy = null,
}: {
  eventId: string;
  /** 'home' — under Home's Papic card (saves land back on Home); 'page' — `/studio/papic` (saves land there). */
  seat?: 'home' | 'page';
  /** The filled "+ Add more" — the shipped sheet, built by the caller (web, or Apple's in the app); null: not offered. */
  buy?: ReactNode;
  /** What the pot holds and has left — null when not measured (the counter then says "—", never 0). */
  credits?: { total: number | null; left: number | null } | null;
}) {
  const supabase = await createClient();
  const { data: ev, error } = await supabase
    .from('events')
    .select('event_type, event_date, papic_window_start, papic_window_end, papic_style, papic_on')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) logQueryError('PapicCameraSettings.event', error, { eventId }, 'graceful_degrade');
  if (!ev) {
    return (
      <p role="status" className="py-3 text-[13px] text-ink/65" data-papic-settings-unread="">
        We couldn’t load your Papic settings just now. Nothing has changed — refresh to try again.
      </p>
    );
  }
  const win = resolveStoredWindow({
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
    eventDate: (ev.event_date as string | null) ?? null,
  });
  const windowState = win.startDate ? captureWindowState(win.startDate, win.endIso) : null;
  // The window's line under the counter (the approved controller: "● Open now · until 12 hours after your day").
  const windowWords = (() => {
    const on = formatPapicDayInWords(win.startDate);
    if (!on) return 'Switches on when your date is set';
    if (windowState === 'closed') return 'Closed · your day has passed';
    const from = win.startDate ? papicDayWords(`${win.startDate}T00:00:00+08:00`) : on;
    return `${windowState === 'not_started' ? `Papic turns on ${on}` : `On from ${from}`} · ${PAPIC_UNTIL_WORDS}`;
  })();
  // The dates as the controller says them — "Sat, Dec 12 → Sun, Dec 13, 12 noon" (the venue's clock).
  const spanWords = win.startDate ? papicSpanWords(`${win.startDate}T00:00:00+08:00`, win.endIso) : null;
  const papicStyle = ((ev.papic_style as string | null) ?? 'ORIG') as string;
  // The look's human name for the row — DERIVED from the style table, never a second copy of the five words.
  const styleLabel = PAPIC_STYLES.find((st) => st.id === papicStyle)?.label ?? 'Orig';
  // "Original" spelled out (the approved controller) — the table's short "Orig" is the camera's chip.
  const papicStyleLabel = styleLabel === 'Orig' ? 'Original' : styleLabel;
  const total = credits?.total ?? null;
  const left = credits?.left ?? null;
  const used = total !== null && left !== null ? Math.max(0, total - left) : null;
  // 📷 Which switch the card's head wears, and — once it is "Let everybody shoot now" — what that means, for the ⓘ.
  const head = await readShootNow(eventId, papicIsOn((ev as { papic_on?: unknown }).papic_on));

  return (
    <div className="flex flex-col gap-6 [&_.font-mono]:font-sans" data-papic-camera-settings="">
      {/* (1)+(2) THE CONTROLLER'S TOP, AS APPROVED (`prototypes/papic_controller_one_page_2026-10-23.html`, owner
          2026-10-24 "make it match"): "Papic ⓘ" and its switch (no second "Papic" beside it) · the dates in words ·
          the framed counter (Remaining in green) · the meter · the window's line · the filled Add more · what guests
          chipped in. The house fonts throughout — no mono on this card. */}
      <section className="flex flex-col gap-3" data-papic-top-line="" data-tour="papic-coverage">
        {win.startDate && spanWords ? (
          <div className="flex items-center gap-2" data-papic-dates="">
            <SettingRow label={spanWords} value="" sheetTitle="Change dates" bare>
              <PapicWindowPicker
                returnTo={seat === 'home' ? 'home' : null}
                eventId={eventId}
                eventType={(ev.event_type as string | null) ?? null}
                eventDate={(ev.event_date as string | null) ?? null}
                windowStart={(ev.papic_window_start as string | null) ?? null}
                windowEnd={(ev.papic_window_end as string | null) ?? null}
                windowIsSet={!!(ev.papic_window_start && ev.papic_window_end)}
                days={win.days}
                summary={formatWindowSummary(win.startDate, win.endDate)}
              />
            </SettingRow>
            <InfoTip label="" align="end">
              {head.kind === 'shoot-now' ? (
                <>
                  Papic is on, so the switch beside the card&rsquo;s ⌄ is Let everybody shoot now.{' '}
                  {head.detail ?? 'We couldn’t check it just now — reload to try again.'} Papic itself is turned on or
                  off in Event Details › Photos from guests.{' '}
                </>
              ) : (
                <>
                  The Papic switch beside the card&rsquo;s ⌄ is Papic itself: on, every guest&rsquo;s invite QR is a camera
                  and the one code works; off, nothing can be captured and your credits stay. Once Papic is on, that switch
                  becomes Let everybody shoot now.{' '}
                </>
              )}
              These dates fill in by themselves — up to 6 months before your day, then 12 hours after it ends. Tap them to
              open the cameras earlier or later.
            </InfoTip>
          </div>
        ) : null}

        {credits ? (
          <>
            <dl className={COUNTER_FRAME} data-papic-counter="">
              {(
                [
                  ['Total', total],
                  ['Used', used],
                  ['Remaining', left],
                ] as const
              ).map(([k, v], i) => (
                <div key={k} className={`py-3 ${i > 0 ? 'border-l border-ink/10' : ''}`}>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">{k}</dt>
                  <dd className={`mt-1 text-[22px] font-semibold ${k === 'Remaining' ? 'text-success-700' : 'text-ink'}`} data-papic-counter-value={k.toLowerCase()}>
                    {v === null ? '—' : formatCount(v)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden data-papic-counter-meter="">
              <div className="h-full rounded-full bg-success-600" style={{ width: `${total && left !== null && total > 0 ? Math.max(0, Math.min(100, Math.round((left / total) * 100))) : 0}%` }} />
            </div>
          </>
        ) : null}
        <p className="flex items-center gap-2 text-[14px] text-ink/75" data-papic-window-line="">
          <span aria-hidden className={`h-2 w-2 rounded-full ${windowState === 'open' ? 'bg-success-600' : 'bg-ink/30'}`} />
          {windowWords}
        </p>
        {buy ? <div className="flex" data-papic-add-more="">{buy}</div> : null}
        {/* NOTIFICATION ONLY — the host is told what guests chipped in, not asked. */}
        <GuestContributionsCard eventId={eventId} />
      </section>

      {/* (3) SETTINGS — his five, flat: every control on its line, every explanation in its ⓘ. */}
      <section className="flex flex-col gap-3" data-papic-settings="" data-tour="papic-settings">
        <h2 className="flex items-center gap-3 pt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink/55 before:h-px before:flex-1 before:bg-ink/10 after:h-px after:flex-1 after:bg-ink/10">Settings</h2>
        {/* 🎨 THE FILTER — the approved controller's Filter A (`style-picker.tsx` variant="strip"): five looks across
            one row, the current one marked, one tap saves. Not the 2×3 cards (they made Home's card a screen and a half
            long, walk 2026-10-24) and not a copy of the picker — the SAME forms, drawn small. The word for the current
            look rides the line (derived from the style table). */}
        <div className="flex flex-col gap-2" data-papic-setting="filter">
          <div className="flex items-baseline justify-between gap-3">
            <InfoTip label="Filter" labelClassName="text-[15px] font-semibold text-ink" align="start">
              One look for your whole event. Every photo your guests and suppliers capture gets it on the camera, so your
              Memories feel like one set. Guests cannot change it.
            </InfoTip>
            <span className="truncate text-[12.5px] text-ink/60" data-papic-filter-now="">{papicStyleLabel} · every camera</span>
          </div>
          <StylePicker variant="strip" returnTo={seat === 'home' ? 'home' : null} eventId={eventId} current={papicStyle} />
        </div>
        {/* In the approved sketch's order (owner "Yes", 2026-10-24): Credits per guest (event-wide) · the one door to
            the guest cards · the event's Face tagging switch · Face blocking. "When guests can shoot" is NOT a row here
            any more (owner 2026-10-30): it is the card's head switch once Papic is on — one control per fact. */}
        <div className="divide-y divide-ink/10">
          <GuestAllotmentsChoice eventId={eventId} variant="row" eventWide returnTo={seat === 'home' ? 'home' : null} />
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="flex min-h-11 items-center justify-between gap-3 py-3 text-[15px] text-ink"
            data-papic-guest-card-door=""
          >
            <span>
              Each guest’s camera is on their guest card
              <span className="block text-[12.5px] text-ink/55">Their own number · face tagging · face blocking</span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 text-ink/45" strokeWidth={1.9} />
          </Link>
          <FaceTaggingChoice eventId={eventId} variant="row" returnTo={seat === 'home' ? 'home' : null} subLine="set per guest on their guest card" />
          {/* Face blocking — a COUNT, never a switch (owner 2026-10-24: "each guest's wish is always honoured"). */}
          <FaceBlockingCount eventId={eventId} />
        </div>
      </section>

      {/* (4) CHALLENGES — the board guests see, and what a supplier asks to add. */}
      <div className="border-t border-ink/10 pt-1">
        <CoupleChallengesManager eventId={eventId} inCard returnTo={seat === 'home' ? 'home' : null} />
      </div>
      <VendorChallengesApproval eventId={eventId} />
    </div>
  );
}

/**
 * THE PAPIC MAIN SWITCH — the event's own `papic_on` answer (the capture gate reads it), drawn in the Papic card's
 * HEAD beside the ⌄ (owner 2026-10-24). Its name is the card's own title, so it is said to a screen reader only.
 */
export function PapicSwitch({ eventId, saved }: { eventId: string; saved: boolean | null }) {
  return <AnswerPicker eventId={eventId} column="papic_on" label="Papic" choices={papicChoices()} saved={saved} as="switch" />;
}

/**
 * 📷 THE CARD'S HEAD SWITCH (owner 2026-10-30: *"actually the switch on event home should be the let everybody shoot now
 * function"* · *"of papic on papic's widget with that toggle switch"*), chosen by `lib/papic-shoot-now.ts`:
 *
 *   · Papic ON (and guest cameras not 'off') → `ShootNowSwitch` — `events.papic_guest_capture_early`, saved LIVE through
 *     `setPapicGuestCaptureEarly` (no Apply); the card's line says "Guests can shoot now" / "Guests shoot on the event day".
 *   · otherwise → the Papic switch, unchanged (`papic_on`, into the Event Hub draft) — guests cannot shoot before Papic
 *     is on. Papic on/off also stays in Event Details › Photos from guests and the Maker's Your info.
 *
 * `papicOn` is the LIVE `events.papic_on` Home already read. Held by `home-papic-head-is-shoot-now.test.ts`.
 */
export async function PapicHeadControl({ eventId, papicOn }: { eventId: string; papicOn: boolean | null }) {
  const head = await readShootNow(eventId, papicOn);
  if (head.kind === 'papic') return <PapicSwitch eventId={eventId} saved={papicOn} />;
  return <ShootNowSwitch eventId={eventId} early={head.early} />;
}

/** The line under the card's title: the saved shoot-now state, or the brand line while the head is the Papic switch. */
export async function PapicHeadLine({ eventId, papicOn, brand }: { eventId: string; papicOn: boolean | null; brand: string }) {
  const head = await readShootNow(eventId, papicOn);
  return <>{head.kind === 'shoot-now' ? head.line : brand}</>;
}
