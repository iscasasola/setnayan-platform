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
import { Clock, ChevronRight } from 'lucide-react';
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

const WFQ_CSS = `
.wfq{--ink:var(--m-ink,#1B1A17);--ink-soft:#4F535B;--mulberry:var(--m-mulberry,#1B1A17);
  --line:var(--m-line,rgba(30,26,18,.12));--card:#fff;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  margin:0 0 14px;color:var(--ink);font-family:var(--sans)}
.wfq *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.wfq .wfq-hd{display:flex;align-items:center;gap:7px;margin:0 2px 8px;
  font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.wfq .wfq-hd .wfq-i{color:var(--mulberry)}
.wfq .wfq-list{display:flex;flex-direction:column;gap:7px}
.wfq .wfq-row{display:flex;align-items:center;gap:11px;background:var(--card);
  border:0.5px solid var(--line);border-radius: var(--m-r-md);padding:11px 13px;
  text-decoration:none;color:inherit;transition:transform .13s cubic-bezier(.2,.7,.2,1),box-shadow .3s var(--ease)}
.wfq .wfq-row:active{transform:scale(.99)}
.wfq .wfq-row:hover{box-shadow:0 8px 22px -18px rgba(30,26,18,.4)}
.wfq .wfq-main{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:2px}
.wfq .wfq-nm{font-family:var(--sans);font-weight:600;font-size:13.5px;color:var(--ink);
  line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfq .wfq-sub{font-family:var(--mono);font-size:9px;letter-spacing:.04em;color:var(--ink-soft)}
.wfq .wfq-rt{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.wfq .wfq-wait{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--mulberry);background:rgba(30, 26, 18,.08);border-radius: var(--m-r-full);padding:4px 9px;white-space:nowrap}
.wfq .wfq-chev{color:var(--ink-soft);flex:0 0 auto}
.wfq a:focus-visible{outline:2px solid var(--mulberry);outline-offset:2px}
.wfq .wfq-more{margin-top:1px}
.wfq .wfq-more>summary{list-style:none;cursor:pointer;background:var(--card);
  border:0.5px solid var(--line);border-radius: var(--m-r-md);padding:11px 13px;
  font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.wfq .wfq-more>summary::-webkit-details-marker{display:none}
.wfq .wfq-more[open]>summary{color:var(--ink)}
.wfq .wfq-more>div{margin-top:7px}
html.dark .wfq{--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--card:#2A2E36}
html.dark .wfq .wfq-hd .wfq-i,html.dark .wfq .wfq-wait{color:#C99DB0}
`;

function WaitingRow({ it }: { it: WaitingInquiry }) {
  return (
    <Link href={it.href} className="wfq-row" prefetch={false}>
      <span className="wfq-main">
        <span className="wfq-nm">{it.name}</span>
        {it.city ? <span className="wfq-sub">{it.city}</span> : null}
      </span>
      <span className="wfq-rt">
        <span className="wfq-wait">{waitingLabel(it.waitingSince)}</span>
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
        <Clock className="wfq-i" size={12} strokeWidth={2} aria-hidden />
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
