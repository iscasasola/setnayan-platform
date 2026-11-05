/**
 * 📮 POSTING INTO A FORM (`fieldName`, step 4B-1, 2026-10-09) — for a row that lives inside a `<form>` whose own handlers read
 * its FormData (the guest card's autosave). A row keeps its answer in React state, so by itself it posts NOTHING; with a
 * `fieldName` it carries the answer in a control of that name (`TypedRow`: a hidden input · `SwitchRow`: a visually-hidden
 * checkbox, present when on, absent when off · `Chips`: one such checkbox per chip) and tells the form when a PERSON changed it.
 * Absent (the default) the row draws exactly what it drew before and posts nothing. The form is told with `input` + `change`
 * (a hidden control raises neither by itself) — only from a tap or a keep, never from a render, a re-seed from the server or an
 * Undo's restore, which would write twice or re-apply what was just taken back.
 */
export function tellTheForm(el: HTMLInputElement | null | undefined): void {
  if (!el) return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

