import { MessageCircle, Share, Users } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { ActionButton } from '@/components/action-button';
import type { ShopBadge, TrackerRow, TrackerState } from '@/lib/shop-badges';

/**
 * 🏅 AWARDS AND BADGES — THE TRACKER (owner 2026-10-28: *"so we want to show the badge tracker also? so they know what
 * to accomplish to get the next badge"*; prototype `supplier_in_place_2026-10-28/interactive.html`, Shop › Awards and
 * badges). Inside Shop › Page's "Awards and badges" fold:
 *
 *   the badges couples see today, in the pill · "Next to earn: 100 events · 4 to go" · Save to print
 *   one row per badge — its circle · what it is · where it stands · a bar ONLY where a ladder exists · the one action
 *   that moves it · its state (Earned · N to go · Live · Not yet)
 *
 * Every word arrives composed by `lib/shop-badges.ts` (`badgeTracker`, `nextToEarnLine`, `shopBadges`) from the reads
 * in `lib/shop-badges.server.ts`. ⚠ The rating row has no bar and no goal — no ruling sets one (owner: "don't guess").
 */
export type BadgeTrackerData = {
  /** The pills couples see today (`shopBadges`). */
  pills: ShopBadge[];
  /** "Next to earn: 100 events · 4 to go", or null at the top / when unread. */
  next: string | null;
  rows: TrackerRow[];
  /** /dev only — the print file as a data: URI, so the lab saves the real file with no session. */
  saveHref?: string;
};

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

export function BadgeTracker({ d }: { d: BadgeTrackerData }) {
  return (
    <div className="space-y-2 pb-4" data-badge-tracker="">
      {d.pills.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1" data-badge-pills="">
          {d.pills.map((b) => (
            <ShopBadgePill key={b.key} badge={b} size="sm" />
          ))}
        </div>
      ) : null}
      {d.next ? (
        <p className="text-[13.5px] font-medium text-ink" data-badge-next="">
          {d.next}
        </p>
      ) : null}
      {d.pills.length > 0 ? (
        <SaveFileLink
          href={d.saveHref ?? '/api/vendor/badges?badge=all'}
          filename="setnayan-badges.svg"
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink"
          data-badge-save=""
        >
          <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Save to print
        </SaveFileLink>
      ) : null}

      <div className="divide-y divide-ink/10">
        {d.rows.map((r) => (
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
                    icon={r.kind === 'rating' ? MessageCircle : Users}
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
      <InfoTip label="How badges work" labelClassName="text-[12.5px] text-ink/60" align="start">
        Worked out live from your real bookings, reviews and years — nothing to type. They print on your card and tarps as
        they are on the day you print, and a voided booking takes its medal back.
      </InfoTip>
    </div>
  );
}
