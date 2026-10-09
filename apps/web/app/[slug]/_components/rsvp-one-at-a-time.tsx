'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCount } from '@/lib/format-number';
import { RSVP_FORM_WORD_DEFAULT } from '@/lib/rsvp-form-words';

/**
 * "ASK ONE QUESTION AT A TIME" — the RSVP scene's ONE switch (owner 2026-09-27:
 * *"or just make this a 1 full scene to edit?"* → *"yes"*; off = one scrolling
 * page, on = one question per screen, for elders).
 *
 * 🔑 IT ARRANGES THE FORM THE SERVER ALREADY DREW; IT OWNS NO FIELD. Every
 * question on the card carries `data-rsvp-step`, and this component shows one
 * of them at a time, with "2 of 5", Back, and Next. Without script — or before
 * hydration — nothing is hidden and the page is the one scrolling form it
 * always was, so the switch can never make a reply impossible.
 *
 * A step the card itself is hiding (the meal step after "Regretfully
 * declines", via the card's own `:has()` reveal) is skipped, so a decliner is
 * never walked through questions the card no longer asks. Tapping an answer
 * IS the answer: a radio advances on its own. Enter never sends early — it
 * moves on, the way Next does, because a required box on a later screen would
 * otherwise block the send with nothing on screen to explain it.
 *
 * 📐 THE SCREEN'S ORDER (owner 2026-09-29, on the live RSVP page: *"ask one
 * question per screen is not neatly arranged. there are rules for like this,
 * where the progress bar should be, where the logo, and questions"*). The
 * approved drawing is `prototypes/rsvp_variants_2026-09-27.html` § SWITCH ON —
 * *"The heading and intro stay on the first screen; attending is answered by
 * the tap itself (no button); typed steps get a single Next. Progress dots and
 * Back at the top"* — and the house's one-question rule is the vendor
 * onboarding's (DECISION_LOG 2026-08-10): *"with one question per screen the
 * field label already IS the title"*. So, top to bottom:
 *
 *   1 · the couple's mark (the door's crest) — the header;
 *   2 · PROGRESS, as ONE unit: Back on its left, the filling bar and "2 of 8"
 *       together in the middle — directly under the mark, ABOVE everything the
 *       guest reads. It was mid-card under the invitation's facts, with "1 of 8"
 *       at one edge and the dots at the other: two halves of one fact a whole
 *       row apart;
 *   3 · the invitation's facts (names · date · who is replying · reply-by) —
 *       on the FIRST screen only; later screens fold them to one line
 *       (`data-rsvp-context` / `data-rsvp-context-line`);
 *   4 · the question, as the screen's heading, then its answers;
 *   5 · the one action, LAST — Next at the foot of a question area that keeps
 *       one height, so it does not jump from screen to screen, and sticky
 *       above the phone's home bar when a question runs longer than the screen.
 *
 * WHERE THE PROGRESS GOES: into `[data-rsvp-progress-slot]` when the page drew
 * one inside this form's scope — the door that carries a `lead`
 * (`[data-door-lead]`; the RSVP page puts the slot under the crest), or any
 * `[data-rsvp-scope]` — otherwise right here, at the top of the form (the
 * Event Hub's reply sheet, whose own heading is the header).
 */
export function RsvpOneAtATime({ hint = null }: { /** The couple's own hint under the answers; none = the card's. */ hint?: string | null } = {}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const scopeRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [lead, setLead] = useState<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [awaitingTap, setAwaitingTap] = useState(false);

  const visibleSteps = useCallback((f: HTMLFormElement): HTMLElement[] => {
    // Outermost steps only. A step nested in another would be counted twice —
    // shown as its parent with itself hidden, i.e. a BLANK screen (owner
    // 2026-09-28, "8 of 9"). The card never nests one (pinned by
    // the-rsvp-page-follows-the-maker.test.ts § 9); this is the belt.
    const all = Array.from(f.querySelectorAll<HTMLElement>('[data-rsvp-step]')).filter(
      (el) => !el.parentElement?.closest('[data-rsvp-step]'),
    );
    // Measure with every step shown, so the card's own reveals decide.
    for (const el of all) el.removeAttribute('data-rsvp-away');
    // Drawn = it has a box. `getComputedStyle(el).display` would still read
    // "block" for a step whose PARENT the card hides (the meal inside the
    // attending reveal), so a decliner would be walked through it.
    const live = all.filter((el) => el.getClientRects().length > 0);
    return live;
  }, []);

  const show = useCallback(
    (f: HTMLFormElement, at: number) => {
      const steps = visibleSteps(f);
      const clamped = Math.max(0, Math.min(at, steps.length - 1));
      steps.forEach((el, i) => {
        if (i !== clamped) el.setAttribute('data-rsvp-away', '');
        el.toggleAttribute('data-rsvp-here', i === clamped);
      });
      const here = steps[clamped];
      // The answer tap IS the answer — no Next until one is chosen. A guest who
      // comes Back to an answer already chosen gets Next, since re-tapping the
      // chosen pill fires no change.
      const radios = here ? Array.from(here.querySelectorAll<HTMLInputElement>('input[type="radio"]')) : [];
      setAwaitingTap(radios.length > 0 && !radios.some((r) => r.checked));
      setTotal(steps.length);
      setIndex(clamped);
      f.setAttribute('data-one-at-a-time', '');
      f.toggleAttribute('data-rsvp-last', clamped >= steps.length - 1);
      scopeRef.current?.toggleAttribute('data-rsvp-past-first', clamped > 0);
      return steps;
    },
    [visibleSteps],
  );

  useEffect(() => {
    const f = anchorRef.current?.closest('form') ?? null;
    if (!f) return;
    const scope = f.closest<HTMLElement>('[data-rsvp-scope],[data-door-lead]') ?? f;
    scopeRef.current = scope;
    setForm(f);
    setLead(scope.querySelector<HTMLElement>('[data-rsvp-progress-slot]'));
    const next = document.createElement('div');
    next.setAttribute('data-rsvp-next-slot', '');
    // Sticky over the card's OWN paper — read, not assumed, so it is the
    // theme's surface on the RSVP page and the sheet's paper on the Event Hub.
    next.style.background = groundBehind(f);
    f.appendChild(next);
    setSlot(next);
    show(f, 0);
    return () => {
      next.remove();
      f.removeAttribute('data-one-at-a-time');
      f.removeAttribute('data-rsvp-last');
      scope.removeAttribute('data-rsvp-past-first');
      f.querySelectorAll('[data-rsvp-away]').forEach((el) => el.removeAttribute('data-rsvp-away'));
      f.querySelectorAll('[data-rsvp-here]').forEach((el) => el.removeAttribute('data-rsvp-here'));
    };
  }, [show]);

  const go = useCallback(
    (delta: number) => {
      if (!form) return;
      const steps = visibleSteps(form);
      const current = steps[index];
      if (delta > 0 && current) {
        for (const input of Array.from(current.querySelectorAll<HTMLInputElement>('input,select,textarea'))) {
          if (!input.checkValidity()) {
            show(form, index);
            input.reportValidity();
            return;
          }
        }
      }
      show(form, index + delta);
      // Bring the PROGRESS back into view (it sits under the couple's mark), and
      // only when it has left the screen — a short question never scrolls.
      const top = lead ?? anchorRef.current;
      const rect = top?.getBoundingClientRect();
      if (top && rect && (rect.top < 0 || rect.top > window.innerHeight)) {
        top.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    },
    [form, index, lead, show, visibleSteps],
  );

  // A radio tap is the answer — it advances. Enter moves on instead of sending.
  useEffect(() => {
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type === 'radio') window.setTimeout(() => go(1), 120);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== 'Enter' || t.tagName === 'TEXTAREA') return;
      if (index < total - 1) {
        e.preventDefault();
        go(1);
      }
    };
    form.addEventListener('change', onChange);
    form.addEventListener('keydown', onKey);
    return () => {
      form.removeEventListener('change', onChange);
      form.removeEventListener('keydown', onKey);
    };
  }, [form, go, index, total]);

  const last = total > 0 && index >= total - 1;
  // An empty foot takes no room: on the last screen the Send is in the step.
  useEffect(() => {
    if (slot) slot.hidden = !(total > 1) || last;
  }, [slot, total, last]);
  const progress = total > 1 ? <RsvpStepProgress index={index} total={total} onBack={() => go(-1)} /> : null;
  return (
    <>
      <style>{ONE_AT_A_TIME_CSS}</style>
      <span ref={anchorRef} aria-hidden className="block scroll-mt-6" />
      {lead ? (progress ? createPortal(progress, lead) : null) : progress}
      {slot && !last && total > 1
        ? createPortal(<RsvpStepNext awaitingTap={awaitingTap} onNext={() => go(1)} hint={hint} />, slot)
        : null}
    </>
  );
}

/**
 * The rules the walker's attributes switch on. Every one is scoped to an
 * attribute only the walker sets, so without script — or with the switch off —
 * none of them matches and the card is the one scrolling form.
 */
export const ONE_AT_A_TIME_CSS = [
  '[data-one-at-a-time] [data-rsvp-away]{display:none!important}',
  // Screen 2 onward: the invitation's facts fold to one line.
  '[data-rsvp-past-first] [data-rsvp-context],[data-rsvp-past-first] [data-door-header]{display:none!important}',
  '[data-rsvp-past-first] [data-rsvp-context-line]{display:block!important}',
  // One height for the question area, so Next sits in the same place on every
  // screen. Not on the last one — there the Send is inside the step itself.
  '[data-one-at-a-time]:not([data-rsvp-last]) [data-rsvp-here]{min-height:min(18rem,42dvh)}',
  '[data-rsvp-next-slot]{position:sticky;bottom:0;z-index:1;padding-top:.75rem;padding-bottom:max(.75rem,env(safe-area-inset-bottom))}',
].join('');

/**
 * PROGRESS, AS ONE UNIT. Back on the left (kept, invisible, on the first
 * screen so nothing shifts), the filling bar and its "2 of 8" together in the
 * middle, an equal spacer on the right so the unit stays centred under the
 * couple's mark. The bar is the open-shop wizard's own shape (segments that
 * fill, `role="progressbar"`); the count stays in words because this switch is
 * for elders.
 */
export function RsvpStepProgress({
  index,
  total,
  onBack,
}: {
  index: number;
  total: number;
  onBack: () => void;
}) {
  const label = `Question ${formatCount(index + 1)} of ${formatCount(total)}`;
  return (
    <div className="mb-5 grid grid-cols-[4rem_1fr_4rem] items-center" data-rsvp-progress="">
      <button
        type="button"
        onClick={onBack}
        disabled={index === 0}
        aria-hidden={index === 0 || undefined}
        tabIndex={index === 0 ? -1 : undefined}
        className="-ml-2 min-h-[44px] justify-self-start px-2 text-sm font-medium text-ink/75 hover:text-ink disabled:invisible"
      >
        ‹ Back
      </button>
      <div className="flex flex-col items-center gap-1.5" data-rsvp-progress-unit="">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-label={label}
          className="flex w-full max-w-[12rem] gap-1"
        >
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-ink' : 'bg-ink/15'}`}
            />
          ))}
        </div>
        <p className="text-xs tabular-nums text-ink/70" aria-live="polite">
          {formatCount(index + 1)} of {formatCount(total)}
        </p>
      </div>
      <span aria-hidden />
    </div>
  );
}

/**
 * The one action at the foot of a screen. On the answer screen there is none —
 * the tap is the answer (the approved drawing's "Tap one to continue").
 */
export function RsvpStepNext({ awaitingTap, onNext, hint = null }: { awaitingTap: boolean; onNext: () => void; hint?: string | null }) {
  if (awaitingTap) {
    const own = RSVP_FORM_WORD_DEFAULT.hint.celebrate;
    return (
      <p data-rsvp-line="hint" data-rsvp-word="rsvp:hint" data-rsvp-default={own} className="flex min-h-[48px] items-center justify-center text-sm text-ink/70">
        {hint || own}
      </p>
    );
  }
  return (
    <button type="button" onClick={onNext} className="button-primary min-h-[48px] w-full">
      Next
    </button>
  );
}

/** The first painted background behind `el` — what a sticky bar must wear to hide what scrolls under it. */
function groundBehind(el: HTMLElement): string {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return 'transparent';
}
