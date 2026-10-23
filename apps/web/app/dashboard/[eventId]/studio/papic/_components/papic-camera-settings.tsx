import Link from 'next/link';
import { CalendarDays, ChevronRight, Clapperboard, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readPapicStandings } from '@/lib/papic-standings';
import { readHubDraft } from '@/lib/hub-draft-store';
import { papicChoices } from '@/lib/event-answers';
import { formatWindowSummary, resolveStoredWindow } from '@/lib/papic-window';
import { PAPIC_STYLES } from '@/lib/papic-photo-styles';
import { papicCoverageLine, papicDay } from '@/lib/papic-widget';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { AnswerPicker } from '@/app/dashboard/[eventId]/launch/_components/details-answers';
import PapicWindowPicker from '../papic-window-picker';
import StylePicker from '../style-picker';
import { CoupleChallengesManager } from '../couple-challenges-manager';
import { FaceTaggingChoice } from './face-tagging-choice';
import { PapicBuySheet } from './papic-buy-sheet';
import { SettingRow } from './setting-row';

/**
 * 📷 PAPIC'S CAMERA SETTINGS — EVENT-WIDE, ONE PLACE (owner 2026-10-23, prototype
 * `papic_controller_one_page_2026-10-23.html` + his later rulings): *"expanding opens the rest of the settings under
 * it"*. The SAME component is Home's Papic widget opened in place and the Papic page itself (the page is camera only
 * now; every file — the photos, the wall, Drive, Keep full-res — lives on Memories).
 *
 * The owner's order, dividers between topics, frames only on what presses:
 *   1. Papic on / off (the Event Details answer, the shipped switch) · the dates on one line ("Change dates" opens the
 *      shipped picker);
 *   2. Credits — total · used · remaining, the meter;
 *   3. Add more (the shipped sheet, with "How many do I need?"; Apple's in the app) — after the day, Thank-You Video;
 *   4. Filter — the one look (the shipped StylePicker);
 *   5. Challenges (the shipped CoupleChallengesManager);
 *   6. Face tagging (the shipped choice);
 *   then one quiet line — each guest's camera is on their guest card ›.
 *
 * ⛔ NO "Credits per guest" and no per-guest face list here: per-guest settings live on the guest card.
 * ⚠ A failed read says "couldn't load" — never an empty row, never a zero.
 */
export async function PapicCameraSettings({
  eventId,
  apple = false,
  returnTo = null,
  buyOpen = false,
  buyError = null,
}: {
  eventId: string;
  /** 🍎 The iPhone app where Apple sells — Add more is Apple's sheet, no web price. */
  apple?: boolean;
  /** 🏠 'home' inside Home's widget: each save lands back on Home, the card still open. */
  returnTo?: 'home' | null;
  /** 📍 Open Add more on arrival — an old "?buy=1" link, or a purchase that came back with an error to read. */
  buyOpen?: boolean;
  buyError?: string | null;
}) {
  const supabase = await createClient();
  const [eventRes, standings, draft] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_type, event_date, papic_window_start, papic_window_end, papic_style, papic_on')
      .eq('event_id', eventId)
      .maybeSingle(),
    readPapicStandings(createAdminClient(), eventId).catch(() => null),
    readHubDraft(supabase, eventId).catch(() => undefined),
  ]);
  if (eventRes.error) logQueryError('PapicCameraSettings.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  const ev = eventRes.data as
    | {
        event_type: string | null;
        event_date: string | null;
        papic_window_start: string | null;
        papic_window_end: string | null;
        papic_style: string | null;
        papic_on: boolean | null;
      }
    | null;
  if (!ev) {
    return (
      <p role="status" className="py-3 text-sm text-ink/65" data-papic-settings-unread="">
        couldn’t load — your camera settings did not read. Refresh to see them.
      </p>
    );
  }

  const win = resolveStoredWindow({ windowStart: ev.papic_window_start, windowEnd: ev.papic_window_end, eventDate: ev.event_date });
  const day = papicDay({ eventDate: ev.event_date, startDate: win.startDate, endIso: win.endIso });
  const coverage = papicCoverageLine({ day, startDate: win.startDate, endIso: win.endIso });
  // The draft over live — what the couple is editing, exactly as Event Details shows it.
  const papicOn = draft && 'papic_on' in draft.events ? draft.events.papic_on : ev.papic_on;
  const styleLabel = PAPIC_STYLES.find((s) => s.id === (ev.papic_style ?? 'ORIG'))?.label ?? 'Original';

  // Credits: total bought · used · remaining. An unread pot is "couldn't load", never 0.
  const credits =
    standings && standings.poolRead && standings.creditsTotal !== null && standings.credits !== null
      ? {
          total: standings.creditsTotal,
          left: Math.max(0, standings.credits),
          used: Math.max(0, standings.creditsTotal - standings.credits),
        }
      : null;
  const pct = credits && credits.total > 0 ? Math.round((credits.left / credits.total) * 100) : 0;

  return (
    <div className="flex flex-col divide-y divide-ink/10" data-papic-settings="" data-papic-day={day}>
      {/* 1 · PAPIC ON / OFF · THE DATES */}
      <section className="flex flex-col gap-2 pb-4" data-papic-settings-topic="switch">
        <AnswerPicker
          eventId={eventId}
          column="papic_on"
          label="Papic"
          choices={papicChoices()}
          saved={typeof papicOn === 'boolean' ? papicOn : null}
          as="switch"
        />
        {win.startDate ? (
          <div className="-mx-1">
            <SettingRow
              icon={<CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              label="Dates"
              value={coverage ?? formatWindowSummary(win.startDate, win.endDate)}
              sheetTitle="Change dates"
            >
              <PapicWindowPicker
                eventId={eventId}
                eventType={ev.event_type}
                eventDate={ev.event_date}
                windowStart={ev.papic_window_start}
                windowEnd={ev.papic_window_end}
                windowIsSet={Boolean(ev.papic_window_start && ev.papic_window_end)}
                days={win.days}
                summary={formatWindowSummary(win.startDate, win.endDate)}
                returnTo={returnTo}
              />
            </SettingRow>
          </div>
        ) : (
          <p className="text-sm text-ink/60">Switches on when your date is set.</p>
        )}
      </section>

      {/* 2 · CREDITS — total · used · remaining · 3 · ADD MORE (after the day: Thank-You Video) */}
      <section className="flex flex-col gap-2.5 py-4" data-papic-settings-topic="credits">
        <h3 className="text-[15px] font-semibold text-ink">Credits</h3>
        {credits ? (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center" data-papic-credits="">
              {(
                [
                  ['Total', credits.total],
                  ['Used', credits.used],
                  ['Remaining', credits.left],
                ] as const
              ).map(([k, n]) => (
                <div key={k}>
                  <dt className="text-[12px] text-ink/60">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{formatCount(n)}</dd>
                </div>
              ))}
            </dl>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-ink/10"
              role="meter"
              aria-label="Credits remaining"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="h-full rounded-full bg-terracotta" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p role="status" className="text-sm text-ink/65" data-papic-credits-unread="">
            couldn’t load
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {day === 'after' && apple ? null : day === 'after' ? (
            /* 🍎 After the day the add-on is the Thank-You Video — sold on the web only, never drawn in the app. */
            <ActionButton
              data-web-only=""
              tone="brand"
              icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />}
              label="Thank-You Video"
              href={`/dashboard/${eventId}/studio/thank-you`}
            />
          ) : apple ? (
            <IapPapicSheet eventId={eventId} left={credits?.left ?? null} main />
          ) : (
            <PapicBuySheet
              eventId={eventId}
              left={credits?.left ?? null}
              tone="brand"
              main
              label="Add more"
              defaultOpen={buyOpen}
              error={buyError}
            />
          )}
        </div>
      </section>

      {/* 4 · FILTER — one look for every photo */}
      <section className="py-4" data-papic-settings-topic="filter">
        <div className="-mx-1">
          <SettingRow
            icon={<Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Filter"
            value={styleLabel}
            sheetTitle="Filter"
          >
            <p className="mb-4 text-sm text-ink/65">One look for your whole event — every photo gets it.</p>
            <StylePicker eventId={eventId} current={ev.papic_style ?? 'ORIG'} returnTo={returnTo} />
          </SettingRow>
        </div>
      </section>

      {/* 5 · CHALLENGES — the shipped manager */}
      <section className="py-4" data-papic-settings-topic="challenges">
        <CoupleChallengesManager eventId={eventId} />
      </section>

      {/* 6 · FACE TAGGING — opt-in */}
      <section className="py-4" data-papic-settings-topic="faces">
        <div className="-mx-1">
          <FaceTaggingChoice eventId={eventId} variant="row" returnTo={returnTo} />
        </div>
      </section>

      {/* Per-guest settings live on the guest card — one quiet door. */}
      <p className="pt-4 text-[13px] text-ink/60" data-papic-settings-guests="">
        <Link href={`/dashboard/${eventId}/guests`} className="inline-flex items-center gap-0.5 hover:text-ink">
          Each guest’s camera is on their guest card
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </p>
    </div>
  );
}
