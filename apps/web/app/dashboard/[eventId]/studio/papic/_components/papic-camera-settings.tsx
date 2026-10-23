import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { InfoTip } from '@/app/_components/info-tip';
import { AnswerPicker } from '@/app/dashboard/[eventId]/launch/_components/details-answers';
import { papicChoices } from '@/lib/event-answers';
import { formatCount } from '@/lib/format-number';
import {
  resolveStoredWindow,
  formatWindowSummary,
  formatPapicDayInWords,
  captureWindowState,
} from '@/lib/papic-window';
import { PAPIC_UNTIL_WORDS } from '@/lib/papic-glance';
import PapicWindowPicker from '../papic-window-picker';
import StylePicker from '../style-picker';
import { CoupleChallengesManager } from '../couple-challenges-manager';
import { VendorChallengesApproval } from '../vendor-challenges-approval';
import { SettingRow } from './setting-row';
import { GuestCamerasChoice } from './guest-cameras-choice';
import { GuestAllotmentsChoice } from './guest-allotments-choice';
import { FaceTaggingChoice } from './face-tagging-choice';
import { FaceBlockingList } from './face-blocking-list';

/**
 * papic-camera-settings.tsx — PAPIC, THE CAMERA, IN THE OWNER'S ORDER (owner 2026-10-23: *"Papic holds: Filter,
 * Credits per guest, face tagging, face blocking, challenge"*; approved `prototypes/papic_controller_one_page_2026-10-23.html`):
 *
 *   the one line — Papic [switch] · the dates
 *   (credits: Total · Used · Remaining — when the caller hands them over)
 *   Settings — Filter · When guests can shoot · Credits per guest · Face tagging · Face blocking
 *   Challenges
 *
 * ONE component, two seats: Home's Papic card draws it UNDER the card when it opens (owner, 23 Oct: *"expanding opens
 * the rest of the settings under it not open a new page"*), and `/studio/papic` draws it for old links. The switch is
 * the event's own `papic_on` answer (the capture gate reads it) — never a second on/off.
 */
export async function PapicCameraSettings({
  eventId,
  credits = null,
  seat = 'page',
}: {
  eventId: string;
  /**
   * 'home' — under Home's Papic card: EVENT-WIDE only (owner 2026-10-23, approved
   * `prototypes/guest_card_groups_and_papic_2026-10-23.html`: per-guest Papic lives on each guest card) — no Credits
   * per guest, no per-guest face blocking; one quiet line points at the guest cards. 'page' — `/studio/papic`, as is.
   */
  seat?: 'home' | 'page';
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
  const windowWords = (() => {
    const on = formatPapicDayInWords(win.startDate);
    if (!on) return 'Switches on when your date is set';
    const waits = captureWindowState(win.startDate, win.endIso) === 'not_started';
    return `${waits ? 'Papic turns on' : 'On from'} ${on} · ${PAPIC_UNTIL_WORDS}`;
  })();
  const total = credits?.total ?? null;
  const left = credits?.left ?? null;
  const used = total !== null && left !== null ? Math.max(0, total - left) : null;

  return (
    <div className="flex flex-col gap-6" data-papic-camera-settings="">
      {/* (1) THE ONE LINE — Papic [switch] · the dates (owner, 23 Oct: "great"). */}
      <section className="flex flex-col gap-1" data-papic-top-line="" data-tour="papic-coverage">
        <div className="flex items-center justify-between gap-3">
          <InfoTip label="Papic" labelAs="h2" labelClassName="text-lg font-semibold tracking-tight text-ink" align="start">
            The switch is Papic itself: on, every guest&rsquo;s invite QR is a camera and the one code works; off, nothing
            can be captured and your credits stay. The dates fill in by themselves — up to 6 months before your day, then
            12 hours after it ends. Tap the dates to open the cameras earlier or later.
          </InfoTip>
          <AnswerPicker
            eventId={eventId}
            column="papic_on"
            label="Papic"
            choices={papicChoices()}
            saved={((ev as { papic_on?: boolean | null }).papic_on ?? null) as boolean | null}
            as="switch"
          />
        </div>
        {win.startDate ? (
          <div className="divide-y divide-ink/10" data-papic-dates="">
            <SettingRow icon={<Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Dates" value={windowWords} sheetTitle="Change dates">
              <PapicWindowPicker
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
          </div>
        ) : null}
      </section>

      {/* (2) THE CREDITS — Total · Used · Remaining (the counter the owner asked for, 23 Oct). */}
      {credits ? (
        <dl className="grid grid-cols-3 gap-2 text-center" data-papic-counter="">
          {(
            [
              ['Total', total],
              ['Used', used],
              ['Remaining', left],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/55">{k}</dt>
              <dd className="text-[19px] font-semibold text-ink">{v === null ? '—' : formatCount(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* (3) SETTINGS — his five, flat: every control on its line, every explanation in its ⓘ. */}
      <section className="flex flex-col gap-3" data-papic-settings="">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Settings</h2>
        <div className="flex flex-col gap-2" data-papic-setting="filter">
          <InfoTip label="Filter" labelClassName="text-[15px] font-semibold text-ink" align="start">
            One look for your whole event. Every photo your guests and suppliers capture gets it on the camera, so your
            Memories feel like one set. Guests cannot change it.
          </InfoTip>
          <StylePicker eventId={eventId} current={((ev.papic_style as string | null) ?? 'ORIG') as string} />
        </div>
        <div className="divide-y divide-ink/10">
          <GuestCamerasChoice eventId={eventId} variant="row" />
          {seat === 'page' ? <GuestAllotmentsChoice eventId={eventId} variant="row" /> : null}
          <FaceTaggingChoice eventId={eventId} variant="row" />
          {seat === 'page' ? <FaceBlockingList eventId={eventId} /> : null}
          {seat === 'home' ? (
            <Link
              href={`/dashboard/${eventId}/guests`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px] text-ink/70"
              data-papic-guest-card-door=""
            >
              <span>Each guest’s camera is on their guest card</span>
              <ChevronRight aria-hidden className="h-4 w-4 text-ink/45" strokeWidth={1.9} />
            </Link>
          ) : null}
        </div>
      </section>

      {/* (4) CHALLENGES — the board guests see, and what a supplier asks to add. */}
      <CoupleChallengesManager eventId={eventId} />
      <VendorChallengesApproval eventId={eventId} />
    </div>
  );
}
