'use client';

/**
 * WaitingForQuotes — a read-only strip at the TOP of the Shortlist tab
 * (inquiry-accepted-visibility, 2026-06-16).
 *
 * Surfaces the vendors the couple has REACHED OUT to whose inquiry is still
 * `pending` (no acceptance / quote yet), oldest-first, with how long each has
 * been waiting. It's purely informational — tap a row to jump to the thread —
 * and carries none of the shortlist's lock/build machinery.
 *
 * Fail-soft by construction: the parent passes an already-filtered, possibly
 * empty list; an empty list renders NOTHING (no header, no card). The waiting
 * label degrades to a quiet "Waiting" if a timestamp is missing/unparseable, so
 * a bad date never throws on this read path.
 *
 * ─── CAPPED, 2026-09-22 ─────────────────────────────────────────────────────
 * This strip renders ABOVE `<ShortlistCategories>` in `vendors/page.tsx`, and it
 * used to `items.map(...)` the whole list. Owner: *"if i have 100 vendors and i
 * am inquire to all… i will not be able to see the bench anymore."* Measured in
 * the approved prototype: with 100 pending inquiries the bench began 4,806px
 * down, against 757px capped.
 *
 * So the first `DEFAULT_ROW_CEILING` rows show and the rest fold into a native
 * `<details>` — NOT a link away. Everything stays in this strip, one tap from
 * where it was, so capping removes no access. `<details>` also needs no
 * JavaScript, which matters because this is a `'use client'` island on a page
 * whose other rows are plain links.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { capRows, hiddenMoreLabel } from '@/lib/capped-rows';

export type WaitingInquiry = {
  /** event_vendors.vendor_id — drives the detail link. */
  vendorId: string;
  /** Resolved (hybrid-anonymity) vendor name, or a quiet fallback. */
  name: string;
  /** Optional city line. */
  city: string | null;
  /** ISO timestamp the inquiry was opened (chat_threads.created_at). */
  waitingSince: string | null;
  /** Thread detail URL. */
  href: string;
};

/** "Just now" / "5m" / "3h" / "2d" / "Waiting" — fail-soft on a bad date. */
function waitingLabel(iso: string | null): string {
  if (!iso) return 'Waiting';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Waiting';
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m waiting`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h waiting`;
  const days = Math.floor(hrs / 24);
  return `${days}d waiting`;
}

/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 13 · 14): a section label in small grey capitals with no box, then
   plain rows on the page divided by one hairline — no card per row — each at least 56 high, the name bold over one
   grey line, the wait as the shared status chip (`Badge`, amber "waiting") and a terracotta › because the row opens.
   Every colour is a token, so dark mode needs no rule of its own; no typewriter captions. */
const WFQ_CSS = `
.wfq{--ink:rgb(var(--color-ink));--ink-soft:rgb(var(--color-ink) / .72);--line:rgb(var(--color-ink) / .1);
  margin:0 0 14px;color:var(--ink)}
.wfq *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.wfq .wfq-hd{display:flex;align-items:center;gap:7px;margin:18px 0 4px;
  font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.wfq .wfq-list{display:flex;flex-direction:column}
.wfq .wfq-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 2px;
  border-top:1px solid var(--line);text-decoration:none;color:inherit}
.wfq .wfq-list>.wfq-row:first-child{border-top:0}
.wfq .wfq-main{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:2px}
.wfq .wfq-nm{font-weight:600;font-size:15px;color:var(--ink);
  line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfq .wfq-sub{font-size:13px;color:var(--ink-soft)}
.wfq .wfq-rt{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.wfq .wfq-chev{color:rgb(var(--color-mulberry));flex:0 0 auto}
.wfq a:focus-visible{outline:2px solid rgb(var(--color-mulberry));outline-offset:2px}
.wfq .wfq-more>summary{list-style:none;cursor:pointer;display:flex;align-items:center;min-height:48px;
  border-top:1px solid var(--line);padding:0 2px;font-size:14px;font-weight:600;color:rgb(var(--color-mulberry))}
.wfq .wfq-more>summary::-webkit-details-marker{display:none}
`;

function WaitingRow({ it }: { it: WaitingInquiry }) {
  return (
    <Link href={it.href} className="wfq-row" prefetch={false}>
      <span className="wfq-main">
        <span className="wfq-nm">{it.name}</span>
        {it.city ? <span className="wfq-sub">{it.city}</span> : null}
      </span>
      <span className="wfq-rt">
        <Badge tone="wait">{waitingLabel(it.waitingSince)}</Badge>
        <ChevronRight className="wfq-chev" size={16} strokeWidth={1.75} aria-hidden />
      </span>
    </Link>
  );
}

export function WaitingForQuotes({ items }: { items: WaitingInquiry[] }) {
  if (!items || items.length === 0) return null;
  const { shown, hiddenCount } = capRows(items);
  // `null` for a zero remainder, by construction — so the row below cannot
  // render "…and 0 more" on a list of exactly the ceiling length.
  const more = hiddenMoreLabel(hiddenCount, 'waiting for a quote');
  return (
    <section className="wfq" aria-label="Waiting for quotes">
      <style>{WFQ_CSS}</style>
      <div className="wfq-hd">
        Waiting for quotes
      </div>
      <div className="wfq-list">
        {shown.map((it) => (
          <WaitingRow key={it.vendorId} it={it} />
        ))}
        {more ? (
          <details className="wfq-more">
            <summary>{more}</summary>
            <div className="wfq-list">
              {items.slice(shown.length).map((it) => (
                <WaitingRow key={it.vendorId} it={it} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
