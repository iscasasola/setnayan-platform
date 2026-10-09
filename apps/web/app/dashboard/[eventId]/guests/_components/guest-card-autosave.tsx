'use client';

/**
 * guest-card-autosave.tsx — the guest card saves itself, and every save can be
 * taken back.
 *
 * ── The one rule that shaped this file ──────────────────────────────────────
 * ONE WRITER. Autosave submits the SAME `<form>` to the SAME `updateGuest`
 * server action the standalone route always used, with the same full FormData
 * contract. It is not a second, lighter write path — so a field that autosaves
 * gets the identical validation, the identical singleton-role checks, the
 * identical FaceBlock re-bake and plus-one sync. A per-field endpoint would
 * have been less code and a second source of truth for every column.
 *
 * ── Why the action goes quiet ───────────────────────────────────────────────
 * `updateGuest` ends in `redirect()`. A redirect on every keystroke-pause
 * remounts the form and throws away the caret, so the card posts `quiet=1`,
 * and on SUCCESS the action revalidates and returns instead of redirecting —
 * the panel stays open and the caret with it. Errors still redirect, because an
 * error has to be SEEN; losing focus to show it is the right trade.
 *
 * ── UNDO, and why it is the same action again ───────────────────────────────
 * A Save button is a moment of consent. Autosave removes it, so a mis-tapped
 * RSVP segment was silent and permanent — the roster's own delete had an undo
 * snackbar and a field edit had nothing. Owner, 2026-09-22: *"add the undo for
 * field edits."*
 *
 * Because `updateGuest` writes the WHOLE document, undo needs no inverse and no
 * new endpoint: it posts the previous FormData back through the same action.
 * That is exact — every column returns to what it was, not only the one that
 * changed — and it keeps the one-writer rule above intact.
 *
 * 🔑 AND IT HAS TO REACH THE SCREEN. Restoring the row while the inputs still
 * showed the new values would be the "green-shaped nothing" this repo keeps
 * finding: the database right and the screen lying. So the undo puts the
 * controls back too — and it cannot do that by assignment alone.
 * `InvitedToChips` renders CONTROLLED checkboxes, and a DOM write to one is
 * overwritten by React on its next render, with the component's state never
 * having changed. Those are driven with a real `click()`, which goes through
 * their `onChange`. Assignment is used only where the input is uncontrolled.
 *
 * ⚠ Restoring fires `change` events, which would schedule another autosave and
 * re-apply the very thing the host just took back. `restoring` suppresses that.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { pushUndo } from './undo-store';

/** Pause after the last change before the form posts. Long enough that typing a
 *  name is one write, short enough that it feels immediate. */
const DEBOUNCE_MS = 700;

/** Plumbing, not columns — never diffed, never restored. */
const NOT_A_FIELD = new Set(['quiet', 'return_to']);

/**
 * WHAT THE LAST SAVE DID — said within the press (step 4C, 2026-10-09). A save that FAILED must never read as one that landed: the
 * line used to say "Saved" whenever the pending state ended, which a thrown or refused save also does. Now the form hears the
 * action's own answer: it landed (`saved`), it did not (`failed` — and the Undo is NOT offered, because nothing was changed to
 * take back), and a save is in flight (`useFormStatus`). A redirect (the action's own way of sending an error to be SEEN) and
 * not-found are the framework's and pass through untouched.
 */
export type AutosaveOutcome = { kind: 'idle' } | { kind: 'saved'; n: number } | { kind: 'failed'; why?: string };
export const OutcomeContext = createContext<{ outcome: AutosaveOutcome; retry: () => void }>({ outcome: { kind: 'idle' }, retry: () => {} });
/** The save line's way to read the outcome (the templated card draws its own line with the same facts). */
export function useAutosaveOutcome() {
  return useContext(OutcomeContext);
}
const isFrameworkSignal = (e: unknown) => {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND') || digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
};

/** What a host calls these, for the snackbar. A name missing here is still
 *  undoable; it just counts toward "N fields" instead of being named.
 *
 *  ⚠ THE NAME `*_LABELS` AND THE TYPE `Record<string, string>` ARE BOTH
 *  LOAD-BEARING FOR A GUARD IN ANOTHER FILE. `tests/db/enum-literals-are-real.db.test.ts`
 *  scans every source for `<column>: '<value>'` and would read `rsvp_status: 'RSVP'`
 *  below as a write of an illegal enum value. It skips maps declared exactly this
 *  way. Rename this to `FIELD_TITLES`, or drop the annotation, and that guard goes
 *  red on correct code — 35 minutes into CI, because it runs in the DB-replay step.
 *  This is a DISPLAY map and never a write payload; if it ever becomes one, the
 *  guard's WRITE_CALL assertion will say so. */
const FIELD_LABELS: Record<string, string> = {
  rsvp_status: 'RSVP',
  meal_preference: 'Meal',
  dietary_restrictions: 'Dietary',
  plus_one_count: 'Extra seats',
  side: 'Side',
  group_category: 'Group',
  role: 'Role',
  attire: 'Attire',
  photo_consent: 'Photo consent',
  faceblock_enabled: 'Live Wall blur',
  face_recognition_excluded: 'Face recognition',
  notes: 'Private note',
  email: 'Email',
  mobile: 'Mobile',
  first_name: 'Name',
  last_name: 'Name',
  middle_name: 'Name',
  name_prefix: 'Name',
  name_suffix: 'Name',
  display_name: 'Display name',
  seniority_rank: 'Tea-ceremony order',
  extra_roles: 'Also serves as',
  group_ids: 'Groups',
  table_id: 'Table',
  passed_away: 'Passed away',
};

/** Field → its posted value(s), compared as JSON so a multi-valued field cannot
 *  collide with a single one that happens to concatenate the same way. */
function fieldsOf(fd: FormData): Map<string, string> {
  const out = new Map<string, string>();
  for (const key of new Set(fd.keys())) {
    if (NOT_A_FIELD.has(key)) continue;
    out.set(key, JSON.stringify(fd.getAll(key)));
  }
  return out;
}

/** What changed between two posts, named the way a host would name it. */
function describeChange(prev: FormData, next: FormData): string | null {
  const a = fieldsOf(prev);
  const b = fieldsOf(next);
  const changed = new Set<string>();
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if ((a.get(k) ?? '') !== (b.get(k) ?? '')) changed.add(k);
  }
  if (changed.size === 0) return null;

  const named = new Set<string>();
  for (const k of changed) {
    // Invited-to is five inputs; a host thinks of it as one thing.
    named.add(k.startsWith('invited_') ? 'Invited to' : (FIELD_LABELS[k] ?? ''));
  }
  named.delete('');
  const labels = [...named];
  if (labels.length === 1) return `${labels[0]} changed`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} changed`;
  return `${changed.size} fields changed`;
}

/**
 * Put the controls back to a previous post. Assignment for uncontrolled inputs;
 * a real click for checkboxes and radios, because that is the only route that
 * reaches a CONTROLLED island's React state.
 */
function restoreInputs(form: HTMLFormElement, snap: FormData): void {
  for (const el of Array.from(form.elements)) {
    const name = (el as HTMLInputElement).name;
    if (!name || NOT_A_FIELD.has(name)) continue;

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      // An unchecked box posts nothing at all, so presence IS the value.
      if (el.checked !== snap.has(name)) el.click();
    } else if (el instanceof HTMLInputElement && el.type === 'radio') {
      const want = snap.get(name) === el.value;
      if (want && !el.checked) el.click();
    } else if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      // Covers hidden carriers (relation, seniority_rank on non-Chinese rites)
      // as well as every visible text field and select.
      el.value = (snap.get(name) as string) ?? '';
      // A dropdown's hidden input (`FormPick`) tells its button to re-read it,
      // so the undo reaches the screen and not only the row.
      if (el instanceof HTMLInputElement && el.dataset.formPick !== undefined) {
        el.dispatchEvent(new Event('sn-restore'));
      }
    }
  }
}

/* One post, heard both ways: a save that THREW and a save that was REFUSED. A quiet `updateGuest` RETURNS `{ refused }` instead of
   redirecting (a redirect navigates the card away — blank for a second, the app-wide error toast, the typed words gone); the
   framework's own redirect / not-found still pass through. null = it landed; otherwise the reason ('' when the action gave none). */
export async function hearSave(action: (fd: FormData) => unknown, fd: FormData): Promise<string | null> {
  try {
    return ((await action(fd)) as { refused?: string } | undefined)?.refused ?? null;
  } catch (e) {
    if (isFrameworkSignal(e)) throw e;
    return '';
  }
}

export function AutosaveForm({
  action,
  returnTo,
  className,
  children,
}: {
  action: (formData: FormData) => void | { refused: string } | Promise<void | { refused: string }>;
  /** Where `updateGuest` should send an ERROR back to — the surface the card is
   *  open on, so a failed save lands on the card and not on some other page.
   *  The action validates it stays inside this event's guest routes. */
  returnTo: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last payload known to be on the row — what an undo goes back to. */
  const lastSaved = useRef<FormData | null>(null);
  const restoring = useRef(false);
  const router = useRouter();
  const [outcome, setOutcome] = useState<AutosaveOutcome>({ kind: 'idle' });
  /** The change a submit is carrying: what it replaced, and what it posts. Its Undo is offered once the save LANDS, not before. */
  const carried = useRef<{ prev: FormData | null; next: FormData } | null>(null);
  /** The last save did not land: React's reset-after-action must NOT put the unsaved words back to what the row holds. */
  const failedLast = useRef(false);
  /** Counts the saves that landed, so every one is a NEW outcome (a failure in between must not make the next "Saved" look like the last). */
  const landed = useRef(0);

  // The starting point, captured once the server-rendered inputs exist.
  useEffect(() => {
    if (formRef.current && !lastSaved.current) {
      lastSaved.current = new FormData(formRef.current);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = useCallback((fd: FormData) => hearSave(action, fd), [action]);

  const undoTo = useCallback(
    async (snap: FormData) => {
      const form = formRef.current;
      restoring.current = true;
      try {
        const why = await send(snap);
        if (why !== null) {
          // The Undo did not land: the row still holds what it held, so the controls stay where they are — and it says so.
          setOutcome({ kind: 'failed', why });
          return;
        }
        if (form) restoreInputs(form, snap);
        lastSaved.current = snap;
      } finally {
        restoring.current = false;
      }
      // The row and the inputs now agree; bring the rest of the page along too
      // — the roster row behind the panel, the tags, the status line.
      router.refresh();
    },
    [send, router],
  );

  /* React 19 resets a form after its action returns — and a save that FAILED returns too (the failure is caught below, so the form is not
     thrown to an error boundary). The host's unsaved words are still the only copy of what they typed: the reset is refused for a failed
     save, so they stay on screen next to "Couldn’t save". A NATIVE listener — React calls `form.reset()` itself while it commits, and
     does not run `onReset` for that call (measured). */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const keepUnsaved = (e: Event) => {
      if (failedLast.current) e.preventDefault();
    };
    form.addEventListener('reset', keepUnsaved);
    return () => form.removeEventListener('reset', keepUnsaved);
  }, []);

  /* The action the form posts: the shipped one, with its answer heard. */
  const run = useCallback(
    async (fd: FormData) => {
      const change = carried.current;
      carried.current = null;
      failedLast.current = false;
      const why = await send(fd);
      if (why !== null) {
        failedLast.current = true;
        // Nothing landed: the last saved payload is still the one before this change, and no Undo is offered for it.
        if (change?.prev) lastSaved.current = change.prev;
        setOutcome({ kind: 'failed', why });
        return;
      }
      setOutcome({ kind: 'saved', n: ++landed.current });
      if (change?.prev) {
        const prev = change.prev;
        const label = describeChange(prev, change.next);
        // No label means nothing actually differs — a stray change event, or a field put back to its own value.
        if (label) pushUndo({ label, undo: () => undoTo(prev) });
      }
    },
    [send, undoTo],
  );

  const schedule = () => {
    // A restore fires change events of its own. Acting on them would re-apply
    // exactly what the host just took back.
    if (restoring.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const next = new FormData(form);
      const prev = lastSaved.current;
      carried.current = { prev, next };
      // requestSubmit (not submit) so React's action handler runs and the
      // form's own validity check still applies.
      form.requestSubmit();
      lastSaved.current = next;
    }, DEBOUNCE_MS);
  };

  const retry = useCallback(() => formRef.current?.requestSubmit(), []);
  return (
    <OutcomeContext.Provider value={{ outcome, retry }}>
    <form
      ref={formRef}
      action={run}
      className={className}
      // `change` covers selects, checkboxes and radios; `input` covers typing.
      onChange={schedule}
      onInput={schedule}
    >
      <input type="hidden" name="quiet" value="1" />
      <input type="hidden" name="return_to" value={returnTo} />
      {children}
    </form>
    </OutcomeContext.Provider>
  );
}

/**
 * The save state, in the card header. Lives inside the form so `useFormStatus` can see it. Says nothing at rest — a permanent
 * "Saved" badge on a card nobody has touched is a claim about an event that did not happen — and (step 4C) says what the LAST
 * save really did: "Saving…" while it is in flight, "Saved" for a moment once it LANDED, and "Couldn’t save — Try again" (kept
 * until the next save lands, with a real button) when it did not. A failed save is never drawn as a saved one.
 */
export function AutosaveState() {
  const { pending } = useFormStatus();
  const { outcome, retry } = useAutosaveOutcome();
  const [shown, setShown] = useState(false);
  const seen = useRef(0);

  useEffect(() => {
    if (outcome.kind !== 'saved' || outcome.n === seen.current) return;
    seen.current = outcome.n;
    setShown(true);
    const t = setTimeout(() => setShown(false), 2200);
    return () => clearTimeout(t);
  }, [outcome]);

  return (
    <span
      role={outcome.kind === 'failed' && !pending ? 'alert' : 'status'}
      aria-live="polite"
      className="inline-flex min-h-[1.25rem] items-center gap-1 text-xs text-ink/55"
    >
      {pending ? (
        'Saving…'
      ) : outcome.kind === 'failed' ? (
        <>
          <span className="font-semibold text-danger-700">Couldn’t save.</span>
          <button type="button" onClick={retry} data-autosave-retry="" className="inline-flex min-h-[44px] items-center px-1 font-semibold underline underline-offset-2">
            Try again
          </button>
        </>
      ) : outcome.kind === 'saved' && shown ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} />
          <span className="text-success-800">Saved</span>
        </>
      ) : null}
    </span>
  );
}
