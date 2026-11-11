'use client';

/**
 * 🧮 THE LINE UNDER "NOT COUNTED FOR ▾" (owner 2026-11-04, the approved prototype `count-and-quotes.html`, "Couple · a
 * guest's card"): *"Juan's Kitchen counts 168, not 169 · Every other service still counts Mia."*
 *
 * It moves with the ticks: the field's hidden input fires `change` as the PickMenu is ticked (`CardPick`), and this
 * wrapper hears it bubble — no second copy of the picks. The words are `notCountedResult` (`lib/supplier-count.ts`),
 * which says nothing for a guest whose tick would not move the number (not attending, or outside that service's rule).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { notCountedResult, type CountSelf, type CountedService } from '@/lib/supplier-count';
import { kidsCountSuggestions, kidsSuggestionWords, parseNotCounted } from '@/lib/guest-not-counted';

export function NotCountedResult({
  services,
  saved,
  self,
  field,
  meal = null,
  mealForm,
  children,
}: {
  services: readonly CountedService[];
  /** The ticks the counts were read with. */
  saved: readonly string[];
  self: CountSelf;
  /** The hidden input's name (`NOT_COUNTED_FIELD`). */
  field: string;
  /** The guest's saved meal — `kids` offers "Leave out of <service>'s count?" (owner 2026-11-12; never automatic). */
  meal?: string | null;
  /** The card's autosave form id: a meal picked on the card is heard at once, before it saves. */
  mealForm?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<readonly string[]>(saved);
  const [mealNow, setMealNow] = useState<string | null>(meal);
  const [notNow, setNotNow] = useState<readonly string[]>([]);
  useEffect(() => setMealNow(meal), [meal]);
  useEffect(() => {
    if (!mealForm) return;
    const heard = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.name === 'meal_preference' && (t.form?.id ?? t.getAttribute('form')) === mealForm) setMealNow(t.value);
    };
    document.addEventListener('change', heard);
    document.addEventListener('sn-restore', heard, true);
    return () => {
      document.removeEventListener('change', heard);
      document.removeEventListener('sn-restore', heard, true);
    };
  }, [mealForm]);
  /**
   * The ONE tap: tick that service on the shipped "Not counted for ▾" — its own hidden input, `sn-restore` so the
   * dropdown shows it, `input` + `change` so the card's autosave posts it and the count line moves. Only ever from a tap.
   */
  const leaveOut = (id: string) => {
    const el = ref.current?.querySelector<HTMLInputElement>(`input[type="hidden"][name="${field}"]`);
    if (!el) return;
    const now = parseNotCounted(el.value);
    if (now.includes(id)) return;
    const want = new Set([...now, id]);
    el.value = services.map((s) => s.id).filter((k) => want.has(k)).join(',');
    el.dispatchEvent(new Event('sn-restore'));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const suggest = kidsCountSuggestions(mealNow, services, picked, notNow);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const heard = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.name === field) setPicked(parseNotCounted(t.value));
    };
    el.addEventListener('change', heard);
    el.addEventListener('sn-restore', heard);
    return () => {
      el.removeEventListener('change', heard);
      el.removeEventListener('sn-restore', heard);
    };
  }, [field]);
  const line = notCountedResult(services, picked, saved, self);
  const cut = line ? line.indexOf(' · Every other service') : -1;
  return (
    <div ref={ref}>
      {children}
      {suggest.map((s) => (
        <p key={s.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-4 py-2.5 text-[13px] leading-snug" data-kids-suggestion={s.id}>
          <span className="min-w-0 text-ink">
            <b className="block font-medium">{kidsSuggestionWords(s.label)}</b>
            <span className="block text-ink/60">Kids meal · some caterers still charge kids’ plates.</span>
          </span>
          <span className="flex flex-none gap-1.5">
            <button type="button" className="rounded-full px-3 py-1.5 text-[13px] text-ink/60" onClick={() => setNotNow((d) => [...d, s.id])}>
              Not now
            </button>
            <button type="button" className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-white" onClick={() => leaveOut(s.id)}>
              Leave out
            </button>
          </span>
        </p>
      ))}
      {line ? (
        // Drawn as the prototype draws it: a quiet tint (not a frame — nothing here is pressed), the count on the
        // first line, "Every other service still counts <name>." under it.
        <p className="mb-3 rounded-xl bg-success-50 px-4 py-3 text-[13px] leading-snug" role="status" data-card-not-counted-result="">
          <b className="block font-medium text-ink">{cut < 0 ? line : line.slice(0, cut)}</b>
          {cut < 0 ? null : <span className="block text-ink/70">{line.slice(cut + 3)}</span>}
        </p>
      ) : null}
    </div>
  );
}
