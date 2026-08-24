'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

import { useEffect, useState } from 'react';

/*
 * ✉️ 2026-08-24 (AP-3) — THE INVITATION STOPPED READING LIKE A RECEIPT.
 *
 * The labels here were set in DM Mono — a monospaced DATA face — on somebody's
 * wedding invitation. Measured on a live guest page: these are the mono words a
 * real guest actually reads.
 *
 * 🔒 THE SCOPE IS EXACTLY H-2'S, APPLIED WHERE IT IS NOT GATED: size, tracking,
 * uppercase and tone ALL STAY — ONLY THE FACE CHANGES, and it changes to the
 * editorial sans (delegated call #5 of 2026-08-23 already settled the
 * direction: "sans not DM Mono"). A small tracked label is a normal editorial
 * device; the typewriter face is what made it a receipt.
 *
 * 🔢 MONO KEEPS DIGITS AND LOSES WORDS — the same rule D-8 applies on the
 * dashboard. Anything here that is a VALUE rather than a word stays in mono;
 * the only one is the moment's time label.
 *
 * ⛔ UNTOUCHED, DELIBERATELY: the 0.66rem gild section eyebrows (explicitly
 * protected), the film's small announcements and its "press and hold" pill
 * (that is H-2, and it is OWNER-GATED because the cinematic look is approved
 * and paid for), and the "Created at Setnayan" watermark.
 */

type Props = { targetIso: string };

type Remaining = { days: number; hours: number; minutes: number; seconds: number; isPast: boolean };

function compute(target: number): Remaining {
  const now = Date.now();
  const ms = target - now;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, isPast: false };
}

export function CountdownWidget({ targetIso }: Props) {
  // 🔴 THIS LABEL IS A WEDDING VOW. It read "Until we say 'I do'" on a
  // seven-year-old's birthday and on a graduation — seen on the real pages, not
  // caught by any scan, because it contains none of the words a wedding-word
  // search looks for. A countdown is universal; that sentence is not.
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState<Remaining>(() => compute(target));

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(compute(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // Auto-hide once the wedding starts.
  if (remaining.isPast) return null;

  // A solemn event renders NO countdown at all. Ticking boxes counting down
  // "Days · Hours · Mins · Secs" are anticipation machinery — right for every
  // celebration, wrong at a wake regardless of what the label above them says.
  // (Owner 2026-08-17: a countdown to a funeral is "the clearest example of a
  // shipped mechanism that is actively wrong for it.")
  if (w.solemn) return null;

  const boxes: { label: string; value: number }[] = [
    { label: 'Days', value: remaining.days },
    { label: 'Hours', value: remaining.hours },
    { label: 'Mins', value: remaining.minutes },
    { label: 'Secs', value: remaining.seconds },
  ];

  return (
    <section className="rounded-2xl border border-ink/10 bg-veil/40 p-6 text-center sm:p-8">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">
        {w.eventWord === 'wedding' ? (
          <>Until we say &lsquo;I do&rsquo;</>
        ) : (
          <>Until the day</>
        )}
      </p>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {boxes.map((b) => (
          <div key={b.label} className="rounded-lg border border-ink/10 bg-paper py-3">
            <p className="font-pahina text-3xl font-light tabular-nums sm:text-5xl">
              {String(b.value).padStart(2, '0')}
            </p>
            <p className="mt-1 font-sans text-xs uppercase tracking-[0.15em] text-ink/50">
              {b.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
