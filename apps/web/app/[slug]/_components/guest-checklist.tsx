'use client';

import { useState, useTransition } from 'react';
import { checklistProgress, type ChecklistItem, type ChecklistKey } from '@/lib/guest-checklist';
import { formatCount } from '@/lib/format-number';

/**
 * "YOUR CHECKLIST" — the last 30 days (owner 2026-09-26: *"something
 * interactive they can mark checked if those are ready"*).
 *
 * Each item is a tick; "3 of 5 ready" → "You're all set ✓". A tick is a
 * FUNCTION, so it is still and instant: the box changes the moment it is
 * tapped and the save runs behind it. A save that fails puts the box back and
 * SAYS so — a tick that silently did not stick would read, next visit, like the
 * guest mis-remembering.
 *
 * 🔑 THE SAVE IS THE GUEST'S OWN REPLY ACTION (`submitRsvp`, its checklist
 * branch — +0 server actions), bound on the server to THIS guest on THIS event;
 * the ticks live on the guest (`guest_checklist_ticks`), not on the device, and
 * the couple never sees them.
 */
export function GuestChecklist({
  items,
  initialTicks,
  save,
  daysLeft,
  dateLabel,
  readFailed = false,
}: {
  items: ChecklistItem[];
  initialTicks: ChecklistKey[];
  save: (formData: FormData) => Promise<void>;
  daysLeft: number | null;
  dateLabel: string | null;
  readFailed?: boolean;
}) {
  const [ticks, setTicks] = useState<ChecklistKey[]>(initialTicks);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const { ready, total, allSet } = checklistProgress(items, ticks);

  function toggle(key: ChecklistKey) {
    const done = !ticks.includes(key);
    const before = ticks;
    setTicks(done ? [...ticks, key] : ticks.filter((k) => k !== key));
    setFailed(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('checklist_item', key);
      fd.set('checklist_done', done ? '1' : '0');
      try {
        await save(fd);
      } catch {
        setTicks(before);
        setFailed(true);
      }
    });
  }

  return (
    <section id="your-checklist" aria-labelledby="your-checklist-title" className="mx-auto max-w-md scroll-mt-6 space-y-4">
      {daysLeft != null && dateLabel ? (
        <p className="flex items-baseline gap-3">
          <span className="font-serif text-5xl leading-none text-ink">{daysLeft}</span>
          <span className="font-serif text-lg leading-tight text-ink/70">
            {daysLeft === 1 ? 'day to' : 'days to'}
            <br />
            {dateLabel}
          </span>
        </p>
      ) : null}
      <h2 id="your-checklist-title" className="flex flex-wrap items-baseline gap-x-3 font-serif text-2xl text-ink">
        Your checklist
        <span className="text-sm font-medium text-ink/70" aria-live="polite">
          {allSet ? 'You’re all set ✓' : `${formatCount(ready)} of ${formatCount(total)} ready`}
        </span>
      </h2>
      {readFailed ? (
        <p role="status" className="text-xs text-ink/60">
          We could not load your ticks just now — what you tick still saves.
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-terracotta-700">
          That tick did not save — please tap it again.
        </p>
      ) : null}
      <ul className="divide-y divide-ink/10">
        {items.map((item) => {
          const done = ticks.includes(item.key);
          return (
            <li key={item.key} className="flex items-start gap-4 py-3" data-checklist-item={item.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={item.title}
                onClick={() => toggle(item.key)}
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  done ? 'border-ink bg-ink text-cream' : 'border-ink/30 bg-transparent text-transparent'
                }`}
              >
                <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              </button>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-lg leading-snug text-ink">{item.title}</span>
                {item.swatches && item.swatches.length > 0 ? (
                  <span className="mt-1.5 flex gap-2" aria-label="Motif colours">
                    {item.swatches.map((hex) => (
                      <span
                        key={hex}
                        className="h-5 w-5 rounded-full border border-ink/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                ) : null}
                {item.sub || item.link ? (
                  <span className="mt-0.5 block text-sm text-ink/70">
                    {item.sub}
                    {item.sub && item.link ? ' · ' : null}
                    {item.link ? (
                      <a
                        href={item.link.href}
                        {...(item.link.download ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
                        className="font-medium text-ink underline underline-offset-4"
                      >
                        {item.link.label}
                      </a>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
