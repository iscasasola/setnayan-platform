'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';

import { PABUYA_TEMPLATES, PABUYA_MESSAGE_MAX, type PabuyaTemplate } from '@/lib/pabuya-message';
import type { EgiftActionResult } from '../actions';
import { useStudioActions } from '../../launch/_components/studio-actions-context';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { plainRefusal } from '../../guests/_components/plain-refusal';
import { useMaker } from '../../launch/_components/maker-context';
import { SUPERSEDED, makerLatestWrite, makerNeedsRender, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';

/**
 * THE COUPLE'S OWN WORDS — five starting points, or their own.
 *
 * ⚖ Owner 2026-09-15: *"can we provide 5 templates that we can create for people
 * who will add messages"*, then *"so pick among 5 or create your own."*
 *
 * 🔑 A TEMPLATE FILLS THE BOX; IT DOES NOT BECOME THE ANSWER. Picking one writes
 * its words into the textarea where they can be edited, and what is saved is
 * always the text. So a couple can start from "No obligation at all" and change
 * three words, and nothing later rewrites their page when a template's wording
 * is improved.
 *
 * ⚠ The box starts with whatever is already saved, so opening this screen never
 * looks like an empty field on a page that has words on it.
 *
 * 🧭 In the new Maker's Studio (`stagesStudio`) this is `StudioThanks` below — the same column, the
 * same action, drawn and saved the Studio's way. The E-Gifts page and the shipped Maker keep the
 * editor as it was (its box, its chips, its Save) until they are redrawn.
 */
/**
 * = `HUB_DRAFT_FIELD` of `lib/hub-draft.ts` — SPELLED here, never imported (as `schedule-live.ts`
 * spells the Maker's canvas events). This editor is also the E-Gifts PAGE's, and `lib/hub-draft.ts`
 * imports the Maker's whole draft library (25 modules — themes, fonts, the canvas, the Mood Board):
 * importing one constant from it handed all of that to the E-Gifts page, and re-split the Maker's own
 * first-load chunks around the new sharing (507 KB, never raised — "draft 1-3" went red at 507.4).
 * `draft-1-3-waits-for-apply.test.ts` holds the two equal and this file free of that import.
 */
const HUB_DRAFT_FIELD = 'draft';

type Props = {
  eventId: string;
  initialMessage: string | null;
  /** The starting points for this event's type (`pabuyaTemplatesFor`). Absent ⇒ the owner's five. */
  templates?: readonly PabuyaTemplate[];
};

export function PabuyaMessageEditor(props: Props) {
  const studio = useMaker()?.stagesStudio === true;
  return studio ? <StudioThanks {...props} /> : <ShippedEditor {...props} />;
}

/* ── 🧭 THE STUDIO ──────────────────────────────────────────────────────── */

/** The thank-you words are ONE fact: the newest write wins (`makerLatestWrite`). */
const THANKS_WRITE_KEY = 'events.pabuya_message';

/**
 * 🚪 The Studio mounts this field behind TWO doors at once (E-Gifts, and Prints › Finer Details'
 * switch). They are ONE value: the words kept in one door are shown in the other (`tellOtherDoors`), and a
 * refusal is said in BOTH — the words shown in the other door are not in the draft either. Kept per event,
 * outside either door.
 */
let notDrafted: { eventId: string; why: string; /** The door whose own row already says so (it shows its Form row's failure). */ from?: string } | null = null;
const notDraftedListeners = new Set<() => void>();
/** Exported for `studio-round-3-follows-the-owner.test.ts`, which draws the refused state. */
export function sayNotDrafted(next: { eventId: string; why: string; from?: string } | null) {
  notDrafted = next;
  notDraftedListeners.forEach((hear) => hear());
}
function hearNotDrafted(hear: () => void) {
  notDraftedListeners.add(hear);
  return () => {
    notDraftedListeners.delete(hear);
  };
}

/** The words KEPT in one door, told to the others (the Studio's two doors are one value). */
type KeptWords = { eventId: string; from: string; words: string };
const keptListeners = new Set<(kept: KeptWords) => void>();
function tellOtherDoors(kept: KeptWords) {
  keptListeners.forEach((hear) => hear(kept));
}

/** What a thank-you save that did not land says, when the action gave no sentence of its own. */
const NOT_DRAFTED = 'Please try again.';

/**
 * 🧭 STUDIO › E-GIFTS › THANK-YOU MESSAGE, ON THE FORM ROW (owner 2026-10-08, on the preview: *only the pills became
 * "Start from ▾"; the rest of the old editor is still there*; and 2026-10-09: the remaining Studio pages wear the
 * templates). The Studio's standing rules:
 *
 *   · NO BOX — the words are `TypedRow` (a long one: the pill with a pencil; a tap opens a taller box under its name),
 *     and "Start from" is the Form row's chosen answer (`ChosenRow`, the house dropdown);
 *   · the help is behind ⓘ (15 words for the page's 60);
 *   · NO Save, no "Saved" — keeping the words (tapping out of the box) sends them to the DRAFT
 *     (`savePabuyaMessage` with `HUB_DRAFT_FIELD`, "draft 1-3") and ✓ Apply publishes them. So nothing here says
 *     "Guests see this right away": for these words it is no longer true.
 *
 * ⚡ ONE write when the words are kept, `held` — it used to be one per pause in typing (`makerLatestWrite`, the newest
 * words winning): never more writes than before, fewer while typing. The write answers with no Apply count, so the
 * keep ends in ONE render of the Maker (`makerNeedsRender`): the count on ✓ Apply moves, and the list's own line
 * follows the words. A starting point picked sends its words the same way.
 *
 * 🔴 A refused write is SAID and the words STAY (a paragraph the couple just wrote is never thrown away): under the row,
 * in plain words, with Try again — and in the other door as well. The row never ticks for a save that did not land.
 */
function StudioThanks({ eventId, initialMessage, templates = PABUYA_TEMPLATES }: Props) {
  const { savePabuyaMessage } = useStudioActions();
  const door = useId();
  const [text, setText] = useState(initialMessage ?? '');
  /* The words as they are typed in the open box — for the count only (never the row's own value: a row compares what it keeps with what it held). */
  const [typing, setTyping] = useState<string | null>(null);
  const newest = useRef(0);
  const said = useSyncExternalStore(hearNotDrafted, () => notDrafted, () => notDrafted);
  const refused = said && said.eventId === eventId && said.from !== door ? said.why : null;
  /* Words kept in the other door are shown here. */
  useEffect(() => {
    const hear = (kept: KeptWords) => {
      if (kept.eventId !== eventId || kept.from === door) return;
      setText(kept.words);
      setTyping(null);
    };
    keptListeners.add(hear);
    return () => {
      keptListeners.delete(hear);
    };
  }, [eventId, door]);
  /* …and so do the words the Maker last read. */
  useEffect(() => setText(initialMessage ?? ''), [initialMessage]);

  /** Send these words to the draft. Answers whether they landed — and, if not, why, in plain words. */
  const draft = async (words: string, byRow: boolean): Promise<{ ok: true } | { ok: false; error: string }> => {
    const mine = ++newest.current;
    let res: EgiftActionResult | typeof SUPERSEDED;
    try {
      res = await makerSave(
        () =>
          makerLatestWrite(THANKS_WRITE_KEY, () => {
            const fd = new FormData();
            fd.set('event_id', eventId);
            fd.set('pabuya_message', words);
            /* ⏳ Into the draft — guests read the words after ✓ Apply ("draft 1-3"). */
            fd.set(HUB_DRAFT_FIELD, '1');
            return savePabuyaMessage(fd);
          }),
        requestMakerRefresh,
        { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
      );
    } catch {
      res = { ok: false, error: NOT_DRAFTED };
    }
    /* A later keep carried these words, or is on its way: it answers. */
    if (res === SUPERSEDED || mine !== newest.current) return { ok: true };
    if (res.ok) {
      sayNotDrafted(null);
      makerNeedsRender();
      return { ok: true };
    }
    const why = plainRefusal(res.error, NOT_DRAFTED);
    sayNotDrafted({ eventId, why, ...(byRow ? { from: door } : {}) });
    return { ok: false, error: why };
  };
  const keep = (next: string, byRow: boolean) => {
    const words = next.slice(0, PABUYA_MESSAGE_MAX);
    setText(words);
    setTyping(null);
    tellOtherDoors({ eventId, from: door, words });
    return draft(words, byRow);
  };

  const start = templates.find((t) => t.body === text) ?? null;
  const remaining = PABUYA_MESSAGE_MAX - (typing ?? text).length;
  return (
    <FormRows data="pabuya-words" attrs={{ 'data-pabuya-words': 'studio' }}>
      <TypedRow
        data="pabuya-words"
        name="Your own words"
        about={{ words: 'A short note above your payment details, in your voice. Start from one, change anything.' }}
        value={text}
        empty="Write your own, or start from one"
        placeholder="Write your own, or start from one"
        long
        maxLength={PABUYA_MESSAGE_MAX}
        onType={setTyping}
        onKeep={(next) => keep(next, true)}
        below={
          <>
            <p data-pabuya-count="" className={`pb-2 pr-0.5 text-right text-[12px] ${remaining < 60 ? 'text-danger-700' : 'text-ink/50'}`}>
              {remaining} characters left
            </p>
            {refused ? (
              <p role="alert" data-pabuya-not-drafted="" className="flex flex-wrap items-center gap-x-2 pb-2.5 text-[12.5px] font-semibold text-danger-700">
                These words are not in your draft yet. {refused}
                <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" onClick={() => void keep(text, false)} />
              </p>
            ) : null}
          </>
        }
      />
      <ChosenRow
        name="Start from"
        attrs={{ 'data-pabuya-start': 'studio' }}
        value={start?.key ?? ''}
        buttonText={start?.name ?? (text ? 'Your own' : 'Choose')}
        dataAttr="data-pabuya-start-from"
        options={templates.map((t) => ({ key: t.key, label: t.name, hint: t.body }))}
        onPick={(k) => {
          const t = templates.find((x) => x.key === k);
          if (!t) return;
          void keep(t.body, false);
        }}
      />
    </FormRows>
  );
}

/* ── THE E-GIFTS PAGE AND THE SHIPPED MAKER — as they were ──────────────── */

function ShippedEditor({ eventId, initialMessage, templates = PABUYA_TEMPLATES }: Props) {
  const { savePabuyaMessage } = useStudioActions();
  const [text, setText] = useState(initialMessage ?? '');
  const [saved, setSaved] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const maker = useMaker();

  const dirty = (text.trim() || null) !== saved;
  const remaining = PABUYA_MESSAGE_MAX - text.length;

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('pabuya_message', text);
    /* ⏳ In the Maker the words wait for ✓ Apply (owner 2026-10-08, "draft 1-3") — into the draft. */
    if (maker) fd.set(HUB_DRAFT_FIELD, '1');
    start(async () => {
      const res = maker ? await makerSave(() => savePabuyaMessage(fd), requestMakerRefresh) : await savePabuyaMessage(fd);
      if (res.ok) setSaved(text.trim() || null);
      else setError(res.error ?? 'Could not save your message.');
    });
  }

  return (
    <section className="sn-tile mt-6 p-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-ink">Your own words</h2>
        <p className="max-w-prose text-sm text-ink/60">
          One short paragraph above your payment details, in your voice. Guests read this
          before they decide — it is the part that says <em>why</em>. Leave it empty and the
          page reads as it does now.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setText(t.body)}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta hover:text-terracotta-700"
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink/45">
        Pick one to fill the box, then change anything you like — what you save is your text,
        not the template.
      </p>

      <textarea
        value={text}
        /* In the Event Hub Maker's Details this box has two doors (Words ›
           Thank-you and The Finer Details' switch) — one value (`same-field.ts`). */
        data-same-field="pabuya_message"
        onChange={(e) => setText(e.target.value.slice(0, PABUYA_MESSAGE_MAX))}
        rows={4}
        placeholder="Write your own, or pick one above…"
        className="mt-3 w-full rounded-xl border border-ink/15 bg-cream p-3 text-sm text-ink placeholder:text-ink/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !dirty} className="button-primary">
          {pending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
        {text.trim() ? (
          <button
            type="button"
            onClick={() => setText('')}
            className="text-xs text-ink/55 underline underline-offset-4"
          >
            Clear it
          </button>
        ) : null}
        <span className={remaining < 60 ? 'text-xs text-terracotta-700' : 'text-xs text-ink/40'}>
          {remaining} characters left
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-mulberry">
          {error}
        </p>
      ) : null}
    </section>
  );
}
