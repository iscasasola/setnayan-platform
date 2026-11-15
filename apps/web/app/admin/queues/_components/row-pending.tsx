'use client';

/**
 * RowPending — the first tap on a Work row SHOWS that it started (walk RW-301 (6): "the first row press needed two
 * taps"). Opening a row is a server round trip (that queue's items and their cards are read), and nothing on the row
 * changed until it came back, so the first tap read as ignored and was tapped again. Next's own `useLinkStatus` says
 * when the enclosing <Link> is on its way; the row says "Opening…" for exactly that long. No new look: one small line.
 */
import { useLinkStatus } from 'next/link';

export function RowPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="shrink-0 text-xs text-[color:var(--sn-ink-500)]" data-row-pending>
      Opening…
    </span>
  ) : null;
}
