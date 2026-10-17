/**
 * 👥 ANOTHER SCREEN'S VALUES ON THE GUEST CARD (owner 2026-10-18, two hosts never overwrite — `lib/guest-card-merge.ts`).
 * `updateGuest` answers a save with what the row holds differently from the card this screen started with (`fresh`);
 * they go on the card — only those fields, by the same routes the autosave's Undo uses (a click for a box or a radio,
 * the value for the rest, `sn-restore` for a dropdown's button) — and into the card the next save starts from.
 * Its own module: loaded only the first time it happens (`guest-card-autosave.tsx`), never in the Maker's first load.
 */
export function putElsewhere(form: HTMLFormElement, fresh: Record<string, string[]>, lastSaved: FormData | null): FormData | null {
  putFields(form, fresh);
  if (!lastSaved) return lastSaved;
  const next = new FormData();
  for (const [k, v] of lastSaved.entries()) if (!(k in fresh)) next.append(k, v);
  for (const [k, vs] of Object.entries(fresh)) for (const v of vs) next.append(k, v);
  return next;
}

/** Only the fields named, by the same routes `restoreInputs` uses. */
function putFields(form: HTMLFormElement, fresh: Record<string, string[]>): void {
  for (const el of Array.from(form.elements)) {
    const name = (el as HTMLInputElement).name;
    if (!name || !(name in fresh)) continue;
    const values = fresh[name]!;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.checked !== values.length > 0) el.click();
    } else if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (values[0] === el.value && !el.checked) el.click();
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.value = values[0] ?? '';
      if (el instanceof HTMLInputElement && el.dataset.formPick !== undefined) el.dispatchEvent(new Event('sn-restore'));
    }
  }
}
