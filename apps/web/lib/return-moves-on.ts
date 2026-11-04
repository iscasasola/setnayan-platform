/**
 * return-moves-on.ts — RETURN IN A ONE-LINE FIELD MOVES TO THE NEXT FIELD; IT NEVER SAVES THE FORM.
 *
 * 🔴 THE BUG (owner, iPhone, live card maker 2026-11-04 — "after i placed the price, it finished"). The browser's
 * IMPLICIT SUBMISSION: Enter/Return in any single-line `<input>` inside a `<form>` submits it. The supplier typed a
 * price, pressed the keyboard's Return to move on, and the card was CREATED — no cover, half-filled, in production.
 *
 * ✅ The form decides once, at the form (`onKeyDown` on the `<form>`): Return in a one-line input is stopped and focus
 * goes to the next field that can be reached (a shut fold's fields are `inert` and skipped); on the last field the
 * keyboard is put away. A `<textarea>` keeps its new lines; buttons, checkboxes and radios keep what Return does to
 * them. The Create / Save button is the only way to save.
 * 🔒 app/vendor-dashboard/services/return-never-submits-the-card.test.ts
 */

/** Inputs where Return is NOT a request to move on — the browser's own meaning for them stays. */
const RETURN_KEEPS_ITS_MEANING = new Set(['submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'hidden']);

/** True when this keypress would implicitly submit the form and should move on instead. */
export function returnShouldMoveOn(key: string, tagName: string, inputType: string | null, composing = false): boolean {
  if (key !== 'Enter' || composing) return false;
  if (tagName !== 'INPUT') return false;
  return !RETURN_KEEPS_ITS_MEANING.has((inputType ?? 'text').toLowerCase());
}

const FIELD = 'input, select, textarea';

function reachable(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  if ((el as HTMLInputElement).disabled) return false;
  if (el instanceof HTMLInputElement && RETURN_KEEPS_ITS_MEANING.has(el.type)) return false;
  return el.getClientRects().length > 0;
}

/** The form-level handler. Wire it as `<form onKeyDown={returnMovesOn}>`. */
export function returnMovesOn(e: {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  nativeEvent?: { isComposing?: boolean };
  preventDefault: () => void;
}): void {
  const t = e.target;
  const form = e.currentTarget;
  if (!(t instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) return;
  // A field portalled out of the form (a sheet) bubbles through React here but is not the form's — leave it alone.
  if (!form.contains(t)) return;
  if (!returnShouldMoveOn(e.key, t.tagName, t.type, e.nativeEvent?.isComposing === true)) return;
  e.preventDefault();
  const fields = [...form.querySelectorAll<HTMLElement>(FIELD)].filter((el) => el === t || reachable(el));
  const next = fields[fields.indexOf(t) + 1];
  if (next) next.focus();
  else t.blur();
}

/** Every one-line field in the form reads "next" on a phone's Return key — set once, at the form. */
export function markReturnAsNext(form: HTMLFormElement | null): void {
  if (!form) return;
  for (const el of form.querySelectorAll<HTMLInputElement>('input')) {
    if (RETURN_KEEPS_ITS_MEANING.has(el.type)) continue;
    if (!el.getAttribute('enterkeyhint')) el.setAttribute('enterkeyhint', 'next');
  }
}
