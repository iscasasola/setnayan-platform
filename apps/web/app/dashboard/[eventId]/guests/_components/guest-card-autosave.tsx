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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { pushUndo } from './undo-toast';

/** Pause after the last change before the form posts. Long enough that typing a
 *  name is one write, short enough that it feels immediate. */
const DEBOUNCE_MS = 700;

/** Plumbing, not columns — never diffed, never restored. */
const NOT_A_FIELD = new Set(['quiet', 'return_to']);

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
    }
  }
}

export function AutosaveForm({
  action,
  returnTo,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
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

  // The starting point, captured once the server-rendered inputs exist.
  useEffect(() => {
    if (formRef.current && !lastSaved.current) {
      lastSaved.current = new FormData(formRef.current);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const undoTo = useCallback(
    async (snap: FormData) => {
      const form = formRef.current;
      restoring.current = true;
      try {
        await action(snap);
        if (form) restoreInputs(form, snap);
        lastSaved.current = snap;
      } finally {
        restoring.current = false;
      }
      // The row and the inputs now agree; bring the rest of the page along too
      // — the roster row behind the panel, the tags, the status line.
      router.refresh();
    },
    [action, router],
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
      // requestSubmit (not submit) so React's action handler runs and the
      // form's own validity check still applies.
      form.requestSubmit();
      if (prev) {
        const label = describeChange(prev, next);
        // No label means nothing actually differs — a stray change event, or a
        // field put back to its own value. Offering to undo that is noise.
        if (label) pushUndo({ label, undo: () => undoTo(prev) });
      }
      lastSaved.current = next;
    }, DEBOUNCE_MS);
  };

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      // `change` covers selects, checkboxes and radios; `input` covers typing.
      onChange={schedule}
      onInput={schedule}
    >
      <input type="hidden" name="quiet" value="1" />
      <input type="hidden" name="return_to" value={returnTo} />
      {children}
    </form>
  );
}

/**
 * The save state, in the card header. Lives inside the form so `useFormStatus`
 * can see it. Says nothing at rest — a permanent "Saved" badge on a card nobody
 * has touched is a claim about an event that did not happen.
 */
export function AutosaveState() {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2200);
      wasPending.current = pending;
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-h-[1.25rem] items-center gap-1 text-xs text-ink/55"
    >
      {pending ? (
        'Saving…'
      ) : justSaved ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} />
          <span className="text-success-800">Saved</span>
        </>
      ) : null}
    </span>
  );
}
