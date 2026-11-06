import { MessageCircle, Users } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { ActionButton } from '@/components/action-button';
import type { BadgeShelf, ShopBadge, TrackerRow, TrackerState } from '@/lib/shop-badges';

/**
 * 🏅 YOUR BADGES — Shop › Analytics (owner 2026-10-29: *"Their badges will be on the supplier shop performance
 * page"*). Every badge the shop wears today, drawn by THE one pill (`ShopBadgePill`, never a second drawing), and the
 * next step with how far it is ("Next to earn: 100 events · Gold · 4 to go"). Title + one short line; what earns each
 * badge is behind the ⓘ. A pure view — the page hands in `badgeShelf(facts)` and `badgeTracker(facts)`, read in its
 * own batch. A refused read says so ("Couldn’t load your badges" · "—"), never "none".
 *
 * 📣🗺 THE ONE BADGE TRACKER LIVES HERE (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL":
 * **Analytics › Your badges** = the one badge tracker — bars · next badge; Page keeps the badge pills only). The
 * tracker (owner 2026-10-28: *"so they know what to accomplish to get the next badge"*) moved here from Shop › Page's
 * "Awards and badges" fold (`website/_components/badge-tracker.tsx`, deleted): one row per badge — its circle · what
 * it is · where it stands · a bar ONLY where a ladder exists · the one action that moves it · its state (Earned · N to
 * go · Live · Not yet · Couldn't load). Every word is composed by `lib/shop-badges.ts` (`badgeTracker`).
 * ⚠ The rating row has no bar and no goal — no ruling sets one (owner: "don't guess").
 *
 * Today's "You earned …" line (`badge-earned-line.tsx`) STAYS: it announces a NEW badge once; this is where they live.
 *
 * 🖨 The badge PRINT is not here: it is a piece inside Shop › Promote › Prints (owner 2026-11-06, "the door print and
 * the badge print are pieces INSIDE prints") — `shop-prints-section.tsx`'s "Your badges" row saves the same file.
 */

const STATE_TONE: Record<TrackerState, BadgeTone> = {
  earned: 'ok',
  to_go: 'wait',
  live: 'quiet',
  not_yet: 'quiet',
  unread: 'no',
};

/** The tracker row's circle — the pill's own circle, alone: the mark, or the number / ★, in gold on a gold-foil ring. */
function Circle({ badge }: { badge: ShopBadge }) {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-[1.4px] border-[#d9b866] bg-white text-[13px] font-medium text-[#cb9e4b] dark:bg-[#24211e]"
      style={{ fontFamily: 'var(--font-hub-jost), Jost, system-ui, sans-serif' }}
    >
      {badge.glyph === null ? <SetnayanMark className="h-6 w-6" /> : badge.glyph}
    </span>
  );
}

export function YourBadges({
  shelf,
  rows = null,
}: {
  shelf: BadgeShelf;
  /** One row per badge (`badgeTracker`); null = the tracker's facts were not read (the shelf says so). */
  rows?: TrackerRow[] | null;
}) {
  return (
    <section aria-labelledby="your-badges-title" data-your-badges={shelf.measured ? 'measured' : 'unread'} id="badges">
      <h2 id="your-badges-title" className="sn-sec">
        <InfoTip label="Your badges" align="start">
          Couples see these on your page. Verified comes with your approved documents; the event badges climb at 10 ·
          50 · 100 · 500 · 1,000 · 5,000 · 10,000 finished events; the stars come from trusted reviews; the years from
          the year you started. Worked out live from your real bookings, reviews and years — nothing to type; a voided
          booking takes its medal back.
        </InfoTip>
      </h2>
      <p className="mt-0.5 text-[14px] text-ink/70" data-your-badges-next="">
        {shelf.next}
      </p>
      {!shelf.measured ? (
        <p className="mt-2 text-[14px] text-ink/60" data-your-badges-empty="unread">
          Couldn’t load your badges just now.
        </p>
      ) : shelf.pills.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink/60" data-your-badges-empty="none">
          None yet — they show here by themselves as you earn them.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" data-your-badges-pills="">
          {shelf.pills.map((b) => (
            <ShopBadgePill key={b.key} badge={b} size="sm" title={b.label} />
          ))}
        </div>
      )}

      {rows && rows.length > 0 ? (
        <div className="mt-2 divide-y divide-ink/10" data-badge-tracker="">
          {rows.map((r) => (
            <div key={r.kind + r.key} className="flex items-start gap-3 py-3" data-badge-row={r.kind} data-badge-state={r.state}>
              <Circle badge={r.badge} />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-ink">{r.title}</p>
                <p className="text-[13px] text-ink/60">{r.line}</p>
                {r.bar !== undefined ? (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.bar)} aria-label={`${r.title} progress`}>
                    <i className="block h-full rounded-full bg-success-700" style={{ width: `${r.bar}%` }} />
                  </div>
                ) : null}
                {r.ladder ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2" data-badge-ladder="">
                    {r.ladder.now ? <ShopBadgePill badge={r.ladder.now} size="xs" /> : null}
                    {r.ladder.next ? (
                      <>
                        <span aria-hidden className="text-ink/40">→</span>
                        <span className="opacity-50" data-badge-ladder-next="">
                          <ShopBadgePill badge={r.ladder.next} size="xs" />
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {r.door ? (
                  <div className="mt-2">
                    <ActionButton
                      tone={r.kind === 'rating' ? 'info' : 'neutral'}
                      icon={r.kind === 'rating' ? <MessageCircle aria-hidden="true" strokeWidth={1.9} /> : <Users aria-hidden="true" strokeWidth={1.9} />}
                      label={r.door.label}
                      href={r.door.href}
                      className="min-h-11"
                      data-testid={`badge-door-${r.kind}`}
                    />
                  </div>
                ) : null}
              </div>
              <Badge tone={STATE_TONE[r.state]} data={`badge-${r.kind}`}>
                {r.stateWord}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
