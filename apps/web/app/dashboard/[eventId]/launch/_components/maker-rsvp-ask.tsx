'use client';

import { useState, useTransition } from 'react';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { InfoTip } from '@/app/_components/info-tip';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, RSVP_ASK_TIP, rsvpAsks, type RsvpAskConfig } from '@/lib/rsvp-ask';

/**
 * WHAT DO YOU WANT TO ASK YOUR GUESTS? — the Details panel's newest section
 * (owner 2026-09-25, verbatim: *"with this invitation process in mind we need
 * to add this process on the editor for easier setup. to ask what are the
 * information you want to get from the guest."* Follow-up, item 5: *"yes on
 * and off"*).
 *
 * 💾 THE DRAFT, NEVER LIVE: exactly the `MakerRevealPicker` / `MakerLogo`
 * shape — a press posts `hubDraftAction` intent=save with
 * `events.rsvp_ask_config` directly (the ONE generic draft action; ZERO new
 * server-action exports). Guests keep asking exactly what they ask today
 * until the couple presses Apply.
 *
 * `attending` is not a row here — the owner's own list marks it "always on,
 * not switchable" — so there is nothing to render for it.
 */
export function MakerRsvpAsk({
  eventId,
  current,
  drafted,
}: {
  eventId: string;
  /** The drafted-over-live config (sparse — an absent key is ON). */
  current: RsvpAskConfig;
  /** The draft holds a different set of questions from what guests see. */
  drafted: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<RsvpAskConfig>(current);

  const toggle = (field: (typeof RSVP_ASK_FIELDS)[number], next: boolean) =>
    start(async () => {
      setError(null);
      const patch: RsvpAskConfig = { ...local, [field]: next };
      setLocal(patch);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: patch } }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) {
          setError(r.error);
          setLocal(current); // the save was refused — do not show a switch that did not take
        }
      } catch {
        setError('That did not save. Please try again.');
        setLocal(current);
      }
    });

  return (
    <section className="flex flex-col gap-1 border-t border-ink/10 pt-4" data-made-once="rsvp-ask">
      <p className="mb-1 text-sm font-semibold text-ink">What do you ask your guests?</p>
      <p className="mb-2 text-xs text-ink/60">
        Attending is always asked. Turn the rest on or off for every guest — nobody&rsquo;s answer is deleted by
        turning a question off.
      </p>
      <div className="flex flex-col">
        {RSVP_ASK_FIELDS.map((field) => {
          const on = rsvpAsks(local, field);
          return (
            <label
              key={field}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-ink/5 py-2 last:border-0"
            >
              <span className="flex items-center gap-1.5 text-sm text-ink">
                <InfoTip label={RSVP_ASK_LABEL[field]} align="start">
                  {RSVP_ASK_TIP[field]}
                </InfoTip>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={on}
                disabled={pending}
                onChange={(e) => toggle(field, e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors duration-sn-control ease-sn after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-sn-control after:ease-sn peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5 peer-disabled:opacity-40"
              />
            </label>
          );
        })}
      </div>
      {drafted ? (
        <p className="mt-1 text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
