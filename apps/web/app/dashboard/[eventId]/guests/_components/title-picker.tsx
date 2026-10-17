'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { OTHER_TITLE_KEY, TITLE_MAX, choicesOfTitle, cleanTitle, takeGenderMark, titleChoices, titleKey } from '@/lib/guest-title';

/**
 * 🪪 THE TITLE DROPDOWN, WITH "OTHER TITLE…" — the guest card (template kit) and /guests/new.
 *
 * Owner 2026-10-17: the title pick carries woman or man — "Atty. (Woman)" · "Atty. (Man)" — "so no need to choose".
 * The list is `titleChoices` (lib/guest-title.ts). "Other title…" turns the button into a box IN THE SAME ROW; what
 * they type ("Regional Prosecutor") comes back as two entries at the top of the same list, and the list opens on them
 * — no separate Woman · Man question. Typing "(Woman)" after it picks that entry straight away.
 *
 * Posts ONE hidden input (`name`, default `name_title`) holding the pick's key ("Atty.|woman"); a pick fires
 * `input` + `change` so the card's autosave hears it (the `FormPick` contract), and an Undo's `sn-restore` re-reads it.
 */
export function TitlePicker({
  name = 'name_title',
  label = 'Title',
  value,
  current,
  unlisted,
  narrowTo,
  onPicked,
  className = '',
  id,
}: {
  name?: string;
  label?: string;
  /** The stored pick's key (`titleKey(name_prefix, gender)`). */
  value: string;
  /** The stored title — a typed one stays offered as its two entries. */
  current: string | null;
  /** What the button says while the value is not an entry (the title alone, or "Atty. — Woman or Man?"). */
  unlisted?: { key: string; text: string };
  /** Only this title's own entries (the Guests page sheet: "already narrowed to their own title's two entries"). */
  narrowTo?: string | null;
  /** Told the picked key (the sheet saves on each pick). */
  onPicked?: (key: string) => void;
  className?: string;
  id?: string;
}) {
  const [picked, setPicked] = useState(value);
  const [typed, setTyped] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [reopen, setReopen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicked(value);
    if (ref.current) ref.current.value = value;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reread = () => setPicked(el.value);
    el.addEventListener('sn-restore', reread);
    return () => el.removeEventListener('sn-restore', reread);
  }, []);
  // After a typed title, open the list on its two new entries.
  useEffect(() => {
    if (!reopen) return;
    setReopen(false);
    wrap.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.click();
  }, [reopen]);

  const pick = (key: string) => {
    if (key === OTHER_TITLE_KEY) {
      setTyping(true);
      return;
    }
    if (key === picked) return;
    setPicked(key);
    onPicked?.(key);
    const el = ref.current;
    if (!el) return;
    el.value = key;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const keepTyped = (raw: string) => {
    setTyping(false);
    const { text, gender } = takeGenderMark(raw);
    const t = cleanTitle(text);
    if (!t) return;
    if (gender) {
      pick(titleKey(t, gender));
      return;
    }
    const own = choicesOfTitle(t);
    if (own.length === 1) {
      pick(own[0]!.key);
      return;
    }
    setTyped(t);
    setReopen(true);
  };

  const options = narrowTo !== undefined ? choicesOfTitle(narrowTo ?? '') : titleChoices({ current, typed, other: true });
  const shown = options.some((o) => o.key === picked) ? undefined : unlisted && picked === unlisted.key ? unlisted.text : undefined;

  return (
    <div ref={wrap} className="min-w-0" data-title-picker="">
      {typing ? (
        <input
          autoFocus
          type="text"
          id={id}
          aria-label="Type the title"
          maxLength={TITLE_MAX}
          placeholder="e.g. Regional Prosecutor"
          autoCapitalize="words"
          data-title-typed=""
          className={`input-field w-full ${className}`}
          onBlur={(e) => keepTyped(e.currentTarget.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              keepTyped(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setTyping(false);
            }
          }}
        />
      ) : (
        <PickMenu label={label} value={picked} options={options} onPick={pick} buttonText={shown} dataAttr="data-title-pick" className={className} />
      )}
      <input ref={ref} type="hidden" name={name} value={picked} data-form-pick="" />
    </div>
  );
}
