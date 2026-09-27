'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
 */
export function RsvpOneAtATime() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);

  const visibleSteps = useCallback((f: HTMLFormElement): HTMLElement[] => {
    const all = Array.from(f.querySelectorAll<HTMLElement>('[data-rsvp-step]'));
    // Measure with every step shown, so the card's own reveals decide.
    for (const el of all) el.removeAttribute('data-rsvp-away');
    const live = all.filter((el) => getComputedStyle(el).display !== 'none');
    return live;
  }, []);

  const show = useCallback(
    (f: HTMLFormElement, at: number) => {
      const steps = visibleSteps(f);
      const clamped = Math.max(0, Math.min(at, steps.length - 1));
      steps.forEach((el, i) => {
        if (i !== clamped) el.setAttribute('data-rsvp-away', '');
      });
      setTotal(steps.length);
      setIndex(clamped);
      f.setAttribute('data-one-at-a-time', '');
      return steps;
    },
    [visibleSteps],
  );

  useEffect(() => {
    const f = anchorRef.current?.closest('form') ?? null;
    if (!f) return;
    setForm(f);
    const next = document.createElement('div');
    next.setAttribute('data-rsvp-next-slot', '');
    f.appendChild(next);
    setSlot(next);
    show(f, 0);
    return () => {
      next.remove();
      f.removeAttribute('data-one-at-a-time');
      f.querySelectorAll('[data-rsvp-away]').forEach((el) => el.removeAttribute('data-rsvp-away'));
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
      anchorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    [form, index, show, visibleSteps],
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
  return (
    <>
      <style>{`[data-one-at-a-time] [data-rsvp-away]{display:none!important}`}</style>
      <span ref={anchorRef} aria-hidden className="block scroll-mt-6" />
      {total > 1 ? (
        <div className="flex items-center justify-between gap-3" data-rsvp-progress>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="min-h-[44px] min-w-[44px] text-sm font-medium text-ink/70 disabled:opacity-0"
          >
            ‹ Back
          </button>
          <p className="text-sm tabular-nums text-ink/70" aria-live="polite">
            {index + 1} of {total}
          </p>
          <span aria-hidden className="flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full ${i === index ? 'w-6 bg-ink' : i < index ? 'w-6 bg-gild' : 'w-1.5 bg-ink/20'}`}
              />
            ))}
          </span>
        </div>
      ) : null}
      {slot && !last && total > 1
        ? createPortal(
            <button type="button" onClick={() => go(1)} className="button-primary min-h-[48px] w-full">
              Next
            </button>,
            slot,
          )
        : null}
    </>
  );
}
