'use client';

/**
 * 📅 THE WHOLE DAY — THE HOSTS' SCHEDULE, RISEN FROM THEIR CHAT WITH ONE SHOP (Unichat part F, drawing
 * `unichat_live_v3_2026-11-20.html` `riseBody('next')`, hosts' side). The ⋯ menu's Schedule raises it over the chat (the
 * one `RiseScreen`, ‹ Back to chat), the twin of the supplier's "Your part of the day" (`agenda-rise.tsx`), drawn from the
 * same parts (`day-rise-parts.tsx`):
 *
 *   Done · N → the week groups (what is dated with THIS shop: meetings, payments)
 *   → Event day · 18 Dec · <venue>: the venue's window bar, its hours, "Set by … · confirmed by the hosts. … sets these
 *     on its card; you confirm on the event Schedule."
 *   → The whole day: "Edit on the event Schedule" (the page that owns it), then every moment of the day as the timeline.
 *     This shop's moments carry "· <shop>" and the stopwatch; a press opens the shipped ask (`AskSupplierSection`, the
 *     same door the Schedule page's moment sheet uses) with this shop already picked. Everybody else's is a hollow dot.
 *
 * A day that could not be read says so; it is never drawn as an empty day (`lib/hosts-whole-day.server.ts`).
 */
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { Sheet } from '@/app/_components/sheet';
import { VenueWindowBar } from '@/app/_components/venue-window-bar';
import { AgendaRows, DAY_COLUMN, DayHead, DayTimeline, type TimelineItem } from '@/app/_components/day-rise-parts';
import { AskSupplierSection } from '@/app/dashboard/[eventId]/schedule/_components/ask-supplier-section';
import { updateScheduleBlock } from '@/app/dashboard/[eventId]/schedule/actions';
import { agendaLine } from '@/lib/client-agenda';
import { clockWords } from '@/lib/schedule-chapters';
import type { HostAsk } from '@/lib/schedule-ask';
import { OUTSIDE_WORDS, backstageVerdict, hostsWindowWords, venueWindowOf, venueWindowWords } from '@/lib/venue-window';
import type { SupplierChapter, SupplierMoment } from '@/lib/supplier-schedule';
import type { WholeDay } from '@/lib/hosts-whole-day';

type Answer = { ok: true; value: string } | { ok: false; error: string };
const NOT_SENT = 'That ask didn’t send — try again.';

function askDoor(eventId: string, lab: boolean) {
  return (blockId: string, fields: Record<string, string>): Promise<Answer> => {
    if (lab) return new Promise((r) => setTimeout(() => r({ ok: true, value: `lab-ask-${blockId}:lab-shop` }), 300));
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('block_id', blockId);
    fd.set('moment_op', 'ask_supplier');
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return updateScheduleBlock(fd).then(
      (r) => (r && r.ok ? { ok: true as const, value: String(r.value) } : { ok: false as const, error: r && !r.ok ? r.error : NOT_SENT }),
      () => ({ ok: false as const, error: NOT_SENT }),
    );
  };
}

export function WholeDayRise({ whole, onClose, lab = false }: { whole: WholeDay; onClose: () => void; lab?: boolean }) {
  const { eventId, shopName, agenda, eventDate, eventDayWords, unreadLine, day, shopBookingIds } = whole;
  const [asks, setAsks] = useState<HostAsk[] | null>(whole.asks);
  const [pick, setPick] = useState<{ chapter: SupplierChapter; moment: SupplierMoment; n: number } | null>(null);
  const sheetTitle = useId();
  const ask = useMemo(() => askDoor(eventId, lab), [eventId, lab]);

  const chapters = day?.chapters ?? [];
  const head = chapters.find((c) => c.linked && venueWindowOf(c)) ?? chapters.find((c) => venueWindowOf(c)) ?? null;
  const w = head ? venueWindowOf(head) : null;
  const ticks = head ? head.moments.filter((m) => m.mine && !m.rightAfter && m.start_at).map((m) => ({ start: m.start_at as string, end: m.end_at })) : [];
  const openAsk = (blockId: string) => asks?.find((a) => a.block_id === blockId && a.status === 'open') ?? null;
  const shopBooking = shopBookingIds[0] ?? null;

  const items: TimelineItem[] = chapters.flatMap((c) =>
    c.moments.map((m) => {
      const out = m.mine && Boolean(m.start_at) && !m.rightAfter && backstageVerdict(c, m.start_at, m.end_at) === 'outside';
      const asked = m.mine ? openAsk(m.block_id) : null;
      const sub = out ? OUTSIDE_WORDS : [c.label, m.mine ? shopName : null, asked?.proposed_start_at ? `asked → ${clockWords(asked.proposed_start_at)}` : null].filter(Boolean).join(' · ');
      return {
        key: m.block_id,
        clock: m.clock,
        label: m.label,
        sub,
        warn: out,
        ...(m.mine && shopBooking && !m.rightAfter && m.start_at && !c.time_tba
          ? { pickLabel: `Ask for a new time: ${m.label}`, onPick: () => setPick((p) => ({ chapter: c, moment: m, n: (p?.n ?? 0) + 1 })) }
          : {}),
        data: { 'data-whole-day-moment': m.mine ? 'shop' : 'other' },
      };
    }),
  );

  return (
    <RiseScreen title="Schedule" line={agendaLine(agenda, eventDate)} onClose={onClose} data="whole-day" back="Back to chat">
      <div className={DAY_COLUMN} data-agenda="" data-whole-day="">
        <AgendaRows agenda={agenda} unreadLine={unreadLine} />

        <section aria-label="Event day" data-agenda-day="">
          <DayHead>{['Event day', eventDayWords, head?.where && head.where !== 'Venue TBA' ? head.where : null].filter(Boolean).join(' · ')}</DayHead>
          {day === null ? (
            <p role="alert" className="text-sm text-danger-700">Couldn’t load the day just now. Reload to try again.</p>
          ) : w && head ? (
            <div className="grid gap-1" data-venue-window={head.block_id}>
              <VenueWindowBar window={w} ticks={ticks} />
              <p className="text-[13px] text-ink/70">
                <b className="font-semibold text-ink">{venueWindowWords(w)}</b>
                <br />
                <span data-window-set-by="">{hostsWindowWords(head.hoursHeldBy)}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/70">You haven’t set the day’s hours yet.</p>
          )}
        </section>

        {day ? (
          <section aria-label="The whole day" data-whole-day-moments="">
            <DayHead>The whole day</DayHead>
            <Link
              href={`/dashboard/${eventId}/schedule`}
              className="sn-press mb-2 flex min-h-11 items-center gap-3 rounded-xl bg-raised px-3 py-2 shadow-[0_0_0_1px_rgb(var(--color-ink)/0.08)]"
              data-whole-day-edit=""
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-ink">Edit on the event Schedule</b>
                <small className="block text-[13px] text-ink/60">Tap a {shopName} moment to ask for a new time</small>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/50" />
            </Link>
            {items.length === 0 ? <p className="text-sm text-ink/70">No moments on the day yet.</p> : <DayTimeline items={items} />}
          </section>
        ) : null}
      </div>
      <Sheet open={pick !== null} onClose={() => setPick(null)} labelledById={sheetTitle} rise>
        {pick ? (
          <div className="grid gap-2 p-4" data-whole-day-ask={pick.moment.block_id}>
            <h2 id={sheetTitle} className="text-lg font-semibold text-ink">
              {pick.moment.label}
            </h2>
            <p className="text-[13px] text-ink/70">
              {pick.moment.clock} · {pick.chapter.label} · {shopName}
            </p>
            <AskSupplierSection
              bare
              noOpenButton
              moment={{ block_id: pick.moment.block_id, start_at: pick.moment.start_at as string, end_at: pick.moment.end_at, vendor_ids: shopBookingIds }}
              chapter={{
                start_at: pick.chapter.start_at ?? (pick.moment.start_at as string),
                end_at: pick.chapter.end_at,
                ingress_minutes_before: pick.chapter.ingress_minutes_before,
                egress_minutes_after: pick.chapter.egress_minutes_after,
              }}
              suppliers={shopBooking ? [{ id: shopBooking, name: shopName }] : []}
              asks={asks}
              ask={ask}
              opener={shopBooking ? { vendorId: shopBooking, n: pick.n } : null}
              onAsked={(row) => setAsks((a) => [row, ...(a ?? [])])}
            />
          </div>
        ) : null}
      </Sheet>
    </RiseScreen>
  );
}

/**
 * The ⋯ menu's Schedule lands here (`?day=1` on the hosts' chat — the page reads the day only then, never on every chat
 * load). ‹ Back to chat (or the phone's Back) steps back to the chat itself, in place.
 */
export function WholeDayFromMenu({ whole, chatHref }: { whole: WholeDay; chatHref: string }) {
  const router = useRouter();
  return <WholeDayRise whole={whole} onClose={() => router.replace(chatHref, { scroll: false })} />;
}
