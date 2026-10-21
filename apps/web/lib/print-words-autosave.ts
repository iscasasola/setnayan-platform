/**
 * 🖨 THE PRINT WORDS FORM SAVES ON EVERY PRESS (owner 2026-10-21, on ⚙ Print settings: *"why is there a save here? when any press
 * changes it right away?"*).
 *
 * Measured in the lab before this (`/dev/maker-lab?studio=1`, every control of the sheet pressed, `window.__labPrintWords` counted):
 * NOTHING posted until ✓ Save — eleven switches, Who guests reply to ▾, the opening line, Show it as ▾ — so a host who pressed a
 * switch and then Done lost the press, while the foot said "Guests see this right away". Now the Studio's print words form posts
 * itself (`SoftPost autosave`): a person's change to any field OF THAT FORM — a switch's carrier checkbox (`tellTheForm`), a
 * dropdown's hidden carrier (told the same way), a typed field — sends the SAME post the Save sent, to the SAME route.
 *
 *   · a press posts at once (`0` — the next tick, so React has committed the new value into the carrier);
 *   · typing posts after a pause (`PRINT_WORDS_TYPING_QUIET_MS`), and leaving the box (`change`) posts at once;
 *   · a field of ANOTHER form, or of none, is not ours (`null`) — the special message and the thank-you keep their own drafted saves;
 *   · ONE post at a time: a change made while a post is in flight is sent once more after it lands, with the form as it is THEN
 *     (`oneAtATime`), so a later press can never be overwritten by an earlier post arriving last.
 */

/** How long typing waits after the last key before it posts (the menu's quiet, `MENU_SAVE_QUIET_MS`). */
export const PRINT_WORDS_TYPING_QUIET_MS = 800;

type Field = { form?: unknown; type?: unknown; tagName?: unknown };

/** A box a person types in — its keystrokes wait for a pause; anything else (a checkbox, a hidden carrier) posts at once. */
function typed(el: Field): boolean {
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = typeof el.type === 'string' ? el.type : 'text';
  return ['text', 'search', 'email', 'tel', 'url'].includes(type);
}

/**
 * How long to wait before posting `form` for an `input`/`change` event on `target` — null when the event is not a change to one of
 * this form's own fields. `target.form` is the field's form also when it is drawn elsewhere and joined by `form=` (the sheet is on
 * `<body>`), which is why the listener sits on the document.
 */
export function printWordsAutosaveWait(kind: string, target: unknown, form: unknown): number | null {
  if (!form || !target || typeof target !== 'object') return null;
  const el = target as Field;
  if (el.form !== form) return null;
  if (kind === 'input' && typed(el)) return PRINT_WORDS_TYPING_QUIET_MS;
  if (kind === 'input' || kind === 'change') return 0;
  return null;
}

/**
 * One send at a time: `run()` while a send is in flight only marks "again"; when the send lands, it runs once more (reading the form
 * afresh). `done` is told the LAST send's answer.
 */
export function oneAtATime<R>(send: () => Promise<R>, done: (r: R) => void): () => void {
  let busy = false;
  let again = false;
  const go = (): void => {
    busy = true;
    void send().then((r) => {
      busy = false;
      if (again) {
        again = false;
        go();
        return;
      }
      done(r);
    });
  };
  return () => {
    if (busy) {
      again = true;
      return;
    }
    go();
  };
}
