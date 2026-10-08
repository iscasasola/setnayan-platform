'use client';

import { useEffect, useRef, useState } from 'react';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerRedrawSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { OPENING_LINE_TEMPLATES } from '@/lib/opening-lines';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * 🧾 STUDIO › INFO ON THE FORM ROW (owner 2026-10-08: *"so first, Info. redesign it based on our rules similar to
 * look? no preview needed since info is just form. but how each row is presented there and create a selector if
 * needed."* · *"prioritize only what they need to input here"* · *"field follow form row style"*; the designer's map
 * `STUDIO_INFO_REDESIGN_2026-10-08_fable.md`; the look and the editing are the approved gallery's § 6 / § 10 —
 * `app/_components/form-row.tsx`).
 *
 * This file holds the page's WORDS rows — Opening line (+ Start from ▾) · Special message · What to bring — and the
 * ONE way every Info row keeps a drafted answer (`studioDraftKeep`). The names are `studio-event-name.tsx`; the
 * fold "More for guests" is `StudioHubSettings` in `studio-tools.tsx`.
 *
 * 🔑 NO NEW WRITE, NO NEW COLUMN. Each row keeps its answer through the door it always had — the ONE draft door
 * (`hubDraftAction` intent=save); guests see it at ✓ Apply.
 *
 * ⚡ THE MINIMUM-REQUEST RULE (controller 2026-10-08): keeping an answer is ONE request and NO render of the Maker —
 * a held save that answers with the Apply bar (`HUB_DRAFT_BAR_FIELD`), the latest write of a fact winning
 * (`makerLatestWrite`). No bridge message draws a name or a line on the page, so the save is a `makerRedrawSave`:
 * the pages the Maker shows redraw in place once the last write in flight has landed.
 * Opening Info sends nothing; opening a row sends nothing; leaving a row unchanged sends nothing.
 *
 * Loaded through `details-lazy.tsx` (`StudioTool`, the `maker-details` chunk) — never in the Maker's first load.
 */

/** The mark every Info row list wears — the Studio's form skin steps aside for them (`lib/studio-details.ts`). */
export const STUDIO_INFO_ROWS = { 'data-studio-info-rows': '' } as const;

/** The draft door — `hubDraftAction` — as a row calls it. */
type StudioDraftDoor = typeof hubDraftAction;
let door: StudioDraftDoor = hubDraftAction;
/**
 * 🧪 THE DEV MAKER LAB HANDS ITS OWN STAND-IN, so no write leaves the browser (`app/dev/maker-lab/maker-lab-shell.tsx`
 * `labDraft` — the same stand-in the lab hands `MainBackgroundPanel` and the RSVP stage as their `draftAction`).
 * Info's rows are drawn by the server, so there is no prop to hand it through; the lab sets the door once, here.
 * Nothing else calls this: everywhere but the lab the door is the real action. `null` puts the real one back.
 */
export function setStudioDraftDoor(next: StudioDraftDoor | null): void {
  door = next ?? hubDraftAction;
}

/**
 * Keep one drafted answer: ONE request, no render of the Maker. Answers whether it landed and, if not, why.
 * `key` names the fact, so two quick keeps of it never land out of order (the later one wins).
 */
export async function studioDraftKeep(eventId: string, key: string, events: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Object.keys(events).length === 0) return { ok: true };
  let res: Awaited<ReturnType<typeof hubDraftAction>> | typeof SUPERSEDED;
  try {
    /* `makerRedrawSave`: a HELD save (no render of the Maker is owed for it) whose change the bridge cannot draw —
       so once the last one in flight has landed, the pages the Maker shows redraw themselves, in place, once. */
    res = await makerRedrawSave(
      () =>
        makerLatestWrite(key, () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify({ events }));
          fd.set(HUB_DRAFT_BAR_FIELD, '1');
          return door(eventId, fd);
        }),
      requestMakerRefresh,
      (r) => r !== SUPERSEDED && r.ok === true,
    );
  } catch {
    return { ok: false, error: 'Please try again.' };
  }
  /* A later keep of the same fact took its place: that one answers for both. */
  if (res === SUPERSEDED) return { ok: true };
  if (!res.ok) return { ok: false, error: res.error || 'Please try again.' };
  return { ok: true };
}

/* ── one fact, two doors ───────────────────────────────────────────────── */

type Door = HTMLInputElement | HTMLTextAreaElement;
const doorsOf = (fact: string) => Array.from(document.querySelectorAll<Door>(`input[data-same-field="${fact}"], textarea[data-same-field="${fact}"]`));

/**
 * The same fact's OTHER doors (Prints › Invitation's opening line, Prints › Finer Details' special message — both
 * stay mounted) take the kept words, so whichever door is used next holds what was kept here.
 *   · `typed` — a door React controls and that only posts with its own form: told through its own setter and a real
 *     `input` event (the way `same-field.ts` copies one door into another);
 *   · `quiet` — a door that SAVES as it is typed: only its box is set. An event there would send the same words a
 *     second time.
 */
function tellOtherDoors(fact: string, text: string, how: 'typed' | 'quiet'): void {
  for (const el of doorsOf(fact)) {
    if (el.value === text) continue;
    if (how === 'quiet') {
      el.value = text;
      continue;
    }
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, 'value')?.set?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** …and what is typed in another door of the fact shows on this row. */
function useOtherDoor(fact: string, onTyped: (text: string) => void): void {
  const told = useRef(onTyped);
  told.current = onTyped;
  useEffect(() => {
    const on = (e: Event) => {
      const t = e.target;
      if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.getAttribute('data-same-field') === fact) told.current(t.value);
    };
    document.addEventListener('input', on, true);
    return () => document.removeEventListener('input', on, true);
  }, [fact]);
}

/* ── the opening line ──────────────────────────────────────────────────── */

const OWN = 'own';

/**
 * ✍ THE OPENING LINE — a typed row, and "Start from ▾" under it (five starting points; a pick FILLS the line, it
 * does not become the answer — the E-Gifts message's own rule).
 *
 * 🚪 ONE DOOR NOW. It had a black Save that posted the whole print-words form (the line into the draft, AND every
 * print switch written live again). Here the line alone goes into the draft — `print_details.opening_line`, the key
 * ✓ Apply publishes (`lib/hub-draft.ts` `HUB_DRAFT_OPENING_LINE_KEY`; `hub-draft-actions.ts` `openingLineWrite`;
 * held by `draft-1-3-waits-for-apply.test.ts`). The words form's own field stays in the page (hidden, the shipped
 * `OpeningLineField`), so a Prints save still carries the line it always carried.
 */
export function StudioOpeningLine({ eventId, value }: { eventId: string; value: string | null }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  useOtherDoor('opening_line', setText);
  const [pickProblem, setPickProblem] = useState<string | null>(null);
  const keep = async (next: string) => {
    setPickProblem(null);
    setText(next);
    tellOtherDoors('opening_line', next, 'typed');
    return studioDraftKeep(eventId, 'events:print_details.opening_line', { print_details: { opening_line: next || null } });
  };
  const picked = OPENING_LINE_TEMPLATES.find((t) => t.body === text) ?? null;
  return (
    <FormRows data="opening-line" attrs={STUDIO_INFO_ROWS}>
      <TypedRow
        data="opening-line"
        name="Opening line"
        about={{ words: 'The first words of the invitation, above your names. Start from one of five, then make it yours.' }}
        value={text}
        empty="Add your opening line"
        maxLength={240}
        onKeep={keep}
        pillAttrs={{ 'data-same-field': 'opening_line' }}
      />
      <ChosenRow
        data="opening-line-start"
        name="Start from"
        value={picked?.key ?? (text ? OWN : null)}
        buttonText={picked?.name ?? (text ? 'Your own' : 'Choose')}
        dataAttr="data-opening-line-start"
        options={[...OPENING_LINE_TEMPLATES.map((t) => ({ key: t.key, label: t.name, hint: t.body })), ...(text && !picked ? [{ key: OWN, label: 'Your own', hint: 'Keep what you wrote' }] : [])]}
        onPick={(k) => {
          const t = OPENING_LINE_TEMPLATES.find((x) => x.key === k);
          if (!t || t.body === text) return;
          const before = text;
          void keep(t.body).then((r) => {
            if (r.ok) return;
            /* Only what did not save goes back — here and in the other door. */
            setText(before);
            tellOtherDoors('opening_line', before, 'typed');
            setPickProblem(`The opening line did not save, so it is back as it was. ${r.error}`);
          });
        }}
        problem={pickProblem}
      />
    </FormRows>
  );
}

/* ── a message ─────────────────────────────────────────────────────────── */

/** Details' own card for a message (`WordsCard`, where the Maker shows one) follows the kept words. */
function showOnCards(fact: string, text: string): void {
  document.querySelectorAll<HTMLElement>(`[data-live-words="${fact}"]`).forEach((el) => {
    const shown = el.querySelector<HTMLElement>('[data-live-words-text]');
    const empty = el.querySelector<HTMLElement>('[data-live-words-empty]');
    if (shown) {
      if (shown.textContent !== text) shown.textContent = text;
      shown.hidden = text === '';
    }
    if (empty) empty.hidden = text !== '';
  });
}

const WORDS = {
  special_message: {
    name: 'Special message',
    about: 'A message of your own to every guest, on its own part of your Event Hub and on The Finer Details card.',
    empty: 'Add a message',
    placeholder: 'A heartfelt note to everyone joining you…',
    /* The other door (Prints › Finer Details) saves as it is typed — it is only shown the kept words. */
    doors: 'quiet',
    value: (text: string): string | null => text,
  },
  what_to_bring: {
    name: 'What to bring',
    about: 'Shown on your Event Hub in its own What to bring part, and in each guest’s welcome.',
    empty: 'Add what to bring',
    placeholder: 'e.g. your invitation QR, a jacket for the garden',
    doors: 'typed',
    value: (text: string): string | null => text || null,
  },
} as const;

/** The two drafted messages Info holds — each its own column of `events`, each a long typed row. */
export type StudioWordsFact = keyof typeof WORDS;
export const STUDIO_WORDS_MAX = 600;

/**
 * ✍ A MESSAGE — Special message (`events.special_message`) and What to bring (`events.what_to_bring`): the pill shows
 * its words (a long one scrolls); a tap opens the taller box under its name; tapping out keeps it — ONE drafted
 * write. There is no Save and no "Saved": the tick in the pencil's place is the save landing, and ✓ Apply's count
 * rises.
 */
export function StudioWords({ eventId, fact, value }: { eventId: string; fact: StudioWordsFact; value: string | null }) {
  const w = WORDS[fact];
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  useOtherDoor(fact, setText);
  return (
    <FormRows data={fact} attrs={STUDIO_INFO_ROWS}>
      <TypedRow
        data={fact}
        name={w.name}
        about={{ words: w.about }}
        value={text}
        empty={w.empty}
        placeholder={w.placeholder}
        long
        maxLength={STUDIO_WORDS_MAX}
        pillAttrs={{ 'data-same-field': fact }}
        onKeep={async (next) => {
          const kept = next.slice(0, STUDIO_WORDS_MAX);
          setText(kept);
          tellOtherDoors(fact, kept, w.doors);
          showOnCards(fact, kept);
          return studioDraftKeep(eventId, `events:${fact}`, { [fact]: w.value(kept) });
        }}
      />
    </FormRows>
  );
}
