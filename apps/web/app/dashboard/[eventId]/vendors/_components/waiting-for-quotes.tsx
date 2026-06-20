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
 */

import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';

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
.wfq{--ink:var(--m-ink,#1E2229);--ink-soft:#4F535B;--mulberry:var(--m-mulberry,#5C2542);
  --line:var(--m-line,rgba(30,34,41,.12));--card:#fff;
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
.wfq .wfq-row:hover{box-shadow:0 8px 22px -18px rgba(30,34,41,.4)}
.wfq .wfq-main{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:2px}
.wfq .wfq-nm{font-family:var(--sans);font-weight:600;font-size:13.5px;color:var(--ink);
  line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfq .wfq-sub{font-family:var(--mono);font-size:9px;letter-spacing:.04em;color:var(--ink-soft)}
.wfq .wfq-rt{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.wfq .wfq-wait{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--mulberry);background:rgba(92,37,66,.08);border-radius: var(--m-r-full);padding:4px 9px;white-space:nowrap}
.wfq .wfq-chev{color:var(--ink-soft);flex:0 0 auto}
.wfq a:focus-visible{outline:2px solid var(--mulberry);outline-offset:2px}
html.dark .wfq{--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--card:#2A2E36}
html.dark .wfq .wfq-hd .wfq-i,html.dark .wfq .wfq-wait{color:#C99DB0}
`;

export function WaitingForQuotes({ items }: { items: WaitingInquiry[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="wfq" aria-label="Waiting for quotes">
      <style>{WFQ_CSS}</style>
      <div className="wfq-hd">
        <Clock className="wfq-i" size={12} strokeWidth={2} aria-hidden />
        Waiting for quotes
      </div>
      <div className="wfq-list">
        {items.map((it) => (
          <Link key={it.vendorId} href={it.href} className="wfq-row" prefetch={false}>
            <span className="wfq-main">
              <span className="wfq-nm">{it.name}</span>
              {it.city ? <span className="wfq-sub">{it.city}</span> : null}
            </span>
            <span className="wfq-rt">
              <span className="wfq-wait">{waitingLabel(it.waitingSince)}</span>
              <ChevronRight className="wfq-chev" size={16} strokeWidth={1.75} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
