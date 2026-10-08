'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, ImagePlus } from 'lucide-react';
import { GIFT_TELL_LINE, giftTellLabel } from '@/lib/gift-record';
import type { GiftRecordReader } from './wish-list';

/* The record sheet (and its upload) is fetched only when a guest presses this. */
const GiftRecordSheet = dynamic(() => import('./gift-record-sheet'), { ssr: false, loading: () => null });

/**
 * 🎁 "SENT A GIFT? SHOW MARIA & JOSE ›" — under the ways to give, for a gift
 * toward NO wish (owner 2026-10-08; design § 2 "A gift toward no wish";
 * prototype `guest()` `.tell`). The same record sheet as "I sent it", with no
 * wish: the couple's list shows it as "Any gift".
 *
 * One dashed row, a button — it opens the sheet, which is loaded on that press.
 */
export function GiftTell({ hostName, record }: { hostName: string; record: GiftRecordReader }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-gift-tell=""
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-mulberry/45 px-3.5 py-3 text-left" // no-card-ok: a <button> — it opens the record sheet
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
          <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14px] font-semibold text-mulberry">{giftTellLabel(hostName)}</b>
          <small className="mt-0.5 block text-[12.5px] text-ink/70">{GIFT_TELL_LINE}</small>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={1.75} />
      </button>
      {open ? (
        <GiftRecordSheet
          eventId={record.eventId}
          hostName={hostName}
          wish={null}
          giverName={record.giverName}
          recognised={record.recognised}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
