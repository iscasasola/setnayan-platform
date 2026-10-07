'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

import { useEffect, useState } from 'react';

import { countdownReading, countdownTargetMs, type CountdownReading } from '@/lib/countdown-target';
import { sceneCardClass, sceneCardTileClass } from '@/lib/scene-card-look';
import { CountdownBigNumber, CountdownCalendar, CountdownCircle, CountdownLine } from './countdown-styles';

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

type Props = {
  targetIso: string;
  /**
   * The VENUE's zone. `events.event_date` is a DATE, so "the wedding day" starts
   * at midnight where the wedding is — not in UTC, and not wherever the reader's
   * laptop is set. Optional so no existing caller changes meaning; both guest
   * call sites pass the coords-derived zone, and the default is the same
   * `DEFAULT_EVENT_TZ` every other date surface falls back to.
   */
  timeZone?: string;
  /**
   * 🖼 THE SCENE BACKGROUND OWNS THE BOX (owner 2026-09-27: *"if we set no
   * background it will remove the square frame"*) — `sceneWidgetIsBare`. True:
   * no card of this widget's own (no border, no fill, no radius); the scene's
   * background, or the page ground, is the box. Absent/false: the card, as the
   * page always looked when no background was chosen.
   */
  bare?: boolean;
  /**
   * 🎨 THE SCENE'S STYLE (owner 2026-09-29, "every scene … at least three
   * premade styles"): `four-tiles` (this file, the default) · `big-number` ·
   * `calendar` (`countdown-styles.tsx`). Absent or unknown draws the tiles. The
   * style only arranges the reading — every guard below runs first, so no style
   * can draw a countdown the tiles would not.
   */
  sceneStyle?: string | null;
};

type Remaining = CountdownReading;

/** 🔢 Home's rule for the days (`countdownReading`, lib/countdown-target.ts) — never a second copy. */
function compute(target: number): Remaining {
  return countdownReading(target, Date.now());
}

export function CountdownWidget({ targetIso, timeZone, bare = false, sceneStyle = null }: Props) {
  // 🔴 THIS LABEL IS A WEDDING VOW. It read "Until we say 'I do'" on a
  // seven-year-old's birthday and on a graduation — seen on the real pages, not
  // caught by any scan, because it contains none of the words a wedding-word
  // search looks for. A countdown is universal; that sentence is not.
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  /*
   * 🔴 THIS USED TO BE `new Date(targetIso).getTime()`, AND THAT LINE WAS THE
   * WHOLE DEFECT. `events.event_date` is a DATE column, so `targetIso` is a
   * DATE-ONLY string, and ECMAScript parses those as UTC — putting the target at
   * 08:00 Manila instead of midnight. A guest at local midnight on the day before
   * was shown 1d 8h when the truthful remaining was 1d 0h, and the clock then
   * hung on eight hours into the wedding day instead of retiring at its start.
   *
   * The arithmetic below is and always was correct: `target - Date.now()` compares
   * two real instants. The bug was entirely in the value handed to it.
   */
  const target = countdownTargetMs(targetIso, timeZone);
  /*
   * 🔴 THIS USED TO BE `useState(() => compute(target))`, AND THAT WAS REACT
   * #418 ON EVERY GUEST PAGE. `compute` reads `Date.now()`, so the server
   * rendered one second and the phone, hydrating a moment later, computed
   * another — "text content does not match server-rendered HTML", measured on
   * prod across three deployments and reproduced unminified on the Secs box
   * (`+ 05` / `- 18`). 🔒 THE CLOCK IS READ ONLY AFTER MOUNT: before it, both
   * sides render the same shell with `––` in each tile (same height, so nothing
   * jumps), and the first tick fills it in the same frame the page becomes
   * interactive. Never move a `Date.now()` back into render here — it renders
   * identically for no `now` in particular, and a test holds that.
   */
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (target === null) return;
    setRemaining(compute(target));
    const id = window.setInterval(() => setRemaining(compute(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // A date we cannot anchor draws NO clock. A missing countdown is a gap; a
  // countdown running to the wrong instant is a lie a guest would act on.
  if (target === null) return null;

  // Auto-hide once the wedding starts (known only once the clock has been read).
  if (remaining?.isPast) return null;

  // A solemn event renders NO countdown at all. Ticking boxes counting down
  // "Days · Hours · Mins · Secs" are anticipation machinery — right for every
  // celebration, wrong at a wake regardless of what the label above them says.
  // (Owner 2026-08-17: a countdown to a funeral is "the clearest example of a
  // shipped mechanism that is actively wrong for it.")
  if (w.solemn) return null;

  const label =
    w.eventWord === 'wedding' ? <>Until we say &lsquo;I do&rsquo;</> : <>Until the day</>;
  if (sceneStyle === 'big-number') {
    return <CountdownBigNumber label={label} remaining={remaining} targetIso={targetIso} bare={bare} />;
  }
  if (sceneStyle === 'line') {
    return <CountdownLine label={label} remaining={remaining} bare={bare} />;
  }
  if (sceneStyle === 'circle') {
    return <CountdownCircle label={label} remaining={remaining} bare={bare} />;
  }
  if (sceneStyle === 'calendar') {
    return <CountdownCalendar label={label} remaining={remaining} targetIso={targetIso} bare={bare} />;
  }

  const boxes: { label: string; value: number | null }[] = [
    { label: 'Days', value: remaining?.days ?? null },
    { label: 'Hours', value: remaining?.hours ?? null },
    { label: 'Mins', value: remaining?.minutes ?? null },
    { label: 'Secs', value: remaining?.seconds ?? null },
  ];

  return (
    <section
      data-scene-card={bare ? 'bare' : 'own'}
      className={sceneCardClass('countdown', bare)}
    >
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">{label}</p>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {boxes.map((b) => (
          /* With no box, the numbers stand on their own — no tile each. */
          <div key={b.label} className={sceneCardTileClass(bare)}>
            <p className="font-pahina text-3xl font-light tabular-nums sm:text-5xl">
              {b.value === null ? '––' : String(b.value).padStart(2, '0')}
            </p>
            {/* /70, not /50: at 12px the units need 4.5:1 on the page itself
                (measured 3.2:1 at /50 on a cream ground). Inside a painted
                scene `--hub-mute-floor` lifts them further where the ground
                needs it (owner 2026-09-27, "text stays readable on any
                background"). */}
            <p className="mt-1 font-sans text-xs uppercase tracking-[0.15em] text-ink/70">
              {b.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
