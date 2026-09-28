'use client';

import { useEffect } from 'react';

/**
 * ONE FIELD, TWO DOORS (Details part 2b; DECISION_LOG "NO 'GO EDIT IT OVER
 * THERE' LINKS": *"the SAME field is right there, editable in place (it writes
 * the one Details field — still one source, two doors, never a copy)"*).
 *
 * A fact typed in Details can sit in two items at once — the thank-you in
 * Words › Thank-you AND under The Finer Details' switch; the opening line in
 * Words › Opening line AND under The Invitation's switch. Every editor stays
 * mounted (`details-workspace.tsx`), so both doors are in the page together.
 * They are ONE value: typing in either door types in both. Without this the
 * print words form (`/api/hub-print/words` reads `form.get`, the FIRST field of
 * a name) would save whichever door came first in the page — the stale one.
 *
 * Every door of one fact carries the same `data-same-field="<fact>"`. An edit
 * in one is copied into the others through the element's own value setter and
 * a real `input` event, so a React-controlled door (`OpeningLineField`,
 * `PabuyaMessageEditor`) takes it into its own state too.
 */
export const SAME_FIELD_ATTR = 'data-same-field';

type Door = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

let copying = false;

function isDoor(el: unknown): el is Door {
  return (
    typeof HTMLElement !== 'undefined' &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
  );
}

/** Copy one door's value into every other door of the same fact. Returns how many it changed. */
export function copyToOtherDoors(from: EventTarget | null, root: ParentNode = document): number {
  if (copying || !isDoor(from)) return 0;
  const fact = from.getAttribute(SAME_FIELD_ATTR);
  if (!fact) return 0;
  let changed = 0;
  copying = true;
  try {
    for (const el of Array.from(root.querySelectorAll(`[${SAME_FIELD_ATTR}="${CSS.escape(fact)}"]`))) {
      if (el === from || !isDoor(el) || el.value === from.value) continue;
      // The prototype's own setter — React tracks the value it last set, so a
      // plain `el.value =` would be swallowed and its `onChange` never fire.
      const proto = Object.getPrototypeOf(el) as object;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, from.value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      changed += 1;
    }
  } finally {
    copying = false;
  }
  return changed;
}

/** Keep every door of every fact in step while the page is open. */
export function useSameFieldDoors(): void {
  useEffect(() => {
    const on = (e: Event) => void copyToOtherDoors(e.target);
    document.addEventListener('input', on, true);
    document.addEventListener('change', on, true);
    return () => {
      document.removeEventListener('input', on, true);
      document.removeEventListener('change', on, true);
    };
  }, []);
}
