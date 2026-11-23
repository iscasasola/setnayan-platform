/**
 * ✍️ The unsaved change a bumped person keeps (owner 2026-11-21: *"their unsaved change is kept in a card with Put it
 * back / Discard"*). A part's unsaved change is what its form fields say that they did not say when the page drew them:
 * a field's `value` against its `defaultValue` (`checked` against `defaultChecked`). Read from the DOM so every part
 * that edits through form fields keeps its change without a line of its own; a field with no `name` is not kept.
 *
 *   · {@link readDirtyFields} — the kept items, at the moment the host took over;
 *   · {@link resetDirtyFields} — the part shows the host's version again (frame 5: *"Until she confirms, the Guests
 *     part still shows Claire's version to everyone"*);
 *   · {@link readLatestValues} — the host's latest, as drawn now (the fields' defaults after the refresh);
 *   · {@link writeFieldValues} — Confirm: the picked values go back into the fields as if typed, and each form that
 *     holds one is submitted — so the part saves through its own action, never a second writer.
 */
import type { DraftItem } from '@/lib/part-editor-lock';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const SKIP = new Set(['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image']);

function fieldsIn(root: ParentNode): Field[] {
  return Array.from(root.querySelectorAll<Field>('input[name], textarea[name], select[name]')).filter(
    (f) => !(f instanceof HTMLInputElement && SKIP.has(f.type)),
  );
}

const isToggle = (f: Field): f is HTMLInputElement => f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio');

function keyOf(f: Field): string {
  return isToggle(f) && f.type === 'radio' ? `${f.name}=${f.value}` : f.name;
}

function defaultOf(f: Field): string {
  if (isToggle(f)) return f.defaultChecked ? 'Yes' : 'No';
  if (f instanceof HTMLSelectElement) {
    const d = Array.from(f.options).find((o) => o.defaultSelected) ?? f.options[0];
    return d ? d.text : '';
  }
  return f.defaultValue;
}

function valueOf(f: Field): string {
  if (isToggle(f)) return f.checked ? 'Yes' : 'No';
  if (f instanceof HTMLSelectElement) return f.selectedOptions[0]?.text ?? '';
  return f.value;
}

function labelOf(f: Field): string {
  const aria = f.getAttribute('aria-label');
  if (aria) return aria;
  const own = f.labels?.[0]?.textContent?.trim();
  if (own) return own;
  if ('placeholder' in f && f.placeholder) return f.placeholder;
  return f.name.replace(/[_-]+/g, ' ');
}

export function readDirtyFields(root: ParentNode | null): DraftItem[] {
  if (!root) return [];
  const out: DraftItem[] = [];
  const seen = new Set<string>();
  for (const f of fieldsIn(root)) {
    const key = keyOf(f);
    if (seen.has(key)) continue;
    const from = defaultOf(f);
    const to = valueOf(f);
    if (from === to) continue;
    seen.add(key);
    out.push({ key, label: labelOf(f), from, to });
  }
  return out;
}

export function resetDirtyFields(root: ParentNode | null): void {
  if (!root) return;
  for (const f of fieldsIn(root)) {
    if (isToggle(f)) f.checked = f.defaultChecked;
    else if (f instanceof HTMLSelectElement) for (const o of Array.from(f.options)) o.selected = o.defaultSelected;
    else f.value = f.defaultValue;
  }
}

export function readLatestValues(root: ParentNode | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!root) return out;
  for (const f of fieldsIn(root)) out[keyOf(f)] ??= defaultOf(f);
  return out;
}

/** Set a field as if typed — React's own value setter, then input + change — so the part's state hears it. */
function setAsTyped(f: Field, shown: string): void {
  if (isToggle(f)) {
    const want = shown === 'Yes';
    if (f.checked !== want) f.click();
    return;
  }
  if (f instanceof HTMLSelectElement) {
    const o = Array.from(f.options).find((x) => x.text === shown);
    if (!o) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(f, o.value);
  } else {
    const proto = f instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(f, shown);
  }
  f.dispatchEvent(new Event('input', { bubbles: true }));
  f.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Confirm: write each value back and submit the forms that hold them. Returns how many fields were found. */
export function writeFieldValues(root: ParentNode | null, values: ReadonlyArray<{ key: string; value: string }>): number {
  if (!root) return 0;
  const byKey = new Map(fieldsIn(root).map((f) => [keyOf(f), f] as const));
  const forms = new Set<HTMLFormElement>();
  let found = 0;
  for (const { key, value } of values) {
    const f = byKey.get(key);
    if (!f) continue;
    found += 1;
    setAsTyped(f, value);
    if (f.form) forms.add(f.form);
  }
  for (const form of forms) form.requestSubmit();
  return found;
}
