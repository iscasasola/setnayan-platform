'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';

import { PABUYA_TEMPLATES, PABUYA_MESSAGE_MAX, type PabuyaTemplate } from '@/lib/pabuya-message';
import { savePabuyaMessage, type EgiftActionResult } from '../actions';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '../../website/editor/_components/pick-menu';
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

/** Every keystroke of the thank-you words is ONE write — the newest text (`makerLatestWrite`). */
const THANKS_WRITE_KEY = 'events.pabuya_message';

/**
 * 🚪 The Studio mounts this field behind TWO doors at once (E-Gifts, and Prints › Finer Details'
 * switch); `same-field.ts` keeps their words one. So a refusal is said in BOTH — the words shown in
 * the other door are not in the draft either. Kept per event, outside either door.
 */
let notDrafted: { eventId: string; why: string } | null = null;
const notDraftedListeners = new Set<() => void>();
/** Exported for `studio-round-3-follows-the-owner.test.ts`, which draws the refused state. */
export function sayNotDrafted(next: { eventId: string; why: string } | null) {
  notDrafted = next;
  notDraftedListeners.forEach((hear) => hear());
}
function hearNotDrafted(hear: () => void) {
  notDraftedListeners.add(hear);
  return () => {
    notDraftedListeners.delete(hear);
  };
}

/**
 * 🧭 STUDIO › E-GIFTS › THANK-YOU MESSAGE (owner 2026-10-08, on the preview: *only the pills became
 * "Start from ▾"; the rest of the old editor is still there*). The Studio's three standing rules:
 *
 *   · NO BOX — the label row, then the words on a full-width row, then the count;
 *   · the help is behind ⓘ (15 words for the page's 60);
 *   · NO Save, no "Saved" — the words go to the DRAFT as they are typed (`savePabuyaMessage` with
 *     `HUB_DRAFT_FIELD`, "draft 1-3") and ✓ Apply publishes them. So nothing here says "Guests see
 *     this right away": for these words it is no longer true.
 *
 * ⚡ One write after a pause (`makerLatestWrite`), `held` — and ✓ Apply sends a write still waiting
 * for its beat FIRST (`announceUnheldWrite`), so words typed a moment before Apply are applied. The
 * write answers with no Apply count, so the burst ends in ONE render of the Maker
 * (`makerNeedsRender`): the count on ✓ Apply moves, and the list's own line follows the words.
 *
 * 🔴 A refused write is SAID and the words STAY in the box (a paragraph the couple just wrote is
 * never thrown away) — with one way to send them again. The next keystroke sends them too.
 */
function StudioThanks({ eventId, initialMessage, templates = PABUYA_TEMPLATES }: Props) {
  const [text, setText] = useState(initialMessage ?? '');
  const box = useRef<HTMLTextAreaElement>(null);
  const newest = useRef(0);
  const said = useSyncExternalStore(hearNotDrafted, () => notDrafted, () => notDrafted);
  const refused = said && said.eventId === eventId ? said.why : null;
  /* A starting point picked here is typed into the other door too: `same-field.ts` (the Maker's one
     listener) hears an `input`, never a pick — so the pick announces itself as one, once it is in the
     box. React sees no change in it (the value is already its own), so nothing is sent twice. */
  const [picked, setPicked] = useState(0);
  useEffect(() => {
    if (picked) box.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [picked]);

  const draft = (words: string) => {
    const mine = ++newest.current;
    void (async () => {
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
        res = { ok: false, error: 'Please try again.' };
      }
      /* A later keystroke carried these words, or is on its way: it answers. */
      if (res === SUPERSEDED || mine !== newest.current) return;
      if (res.ok) {
        sayNotDrafted(null);
        makerNeedsRender();
        return;
      }
      sayNotDrafted({ eventId, why: res.error });
    })();
  };
  const type = (next: string) => {
    const words = next.slice(0, PABUYA_MESSAGE_MAX);
    setText(words);
    return words;
  };

  const start = templates.find((t) => t.body === text) ?? null;
  const remaining = PABUYA_MESSAGE_MAX - text.length;
  return (
    <div data-pabuya-words="studio" className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3" data-pabuya-start="studio">
        <InfoTip label="Your own words" labelClassName="text-[14px] text-ink" align="start">
          A short note above your payment details, in your voice. Start from one, change anything.
        </InfoTip>
        <PickMenu
          label="Start from"
          dataAttr="data-pabuya-start-from"
          value={start?.key ?? ''}
          buttonText={start?.name ?? 'Start from'}
          options={templates.map((t) => ({ key: t.key, label: t.name, hint: t.body }))}
          onPick={(k) => {
            const t = templates.find((x) => x.key === k);
            if (!t) return;
            draft(type(t.body));
            setPicked((n) => n + 1);
          }}
          className="ring-1 ring-ink/10"
        />
      </div>
      <textarea
        ref={box}
        value={text}
        /* One value, two doors (E-Gifts and The Finer Details' switch) — `same-field.ts`. Only the door
           the couple is typing in sends: the other hears a copied (untrusted) event and just follows. */
        data-same-field="pabuya_message"
        onChange={(e) => {
          const words = type(e.target.value);
          if (e.nativeEvent.isTrusted) draft(words);
        }}
        rows={4}
        aria-label="Thank-you message — your own words"
        placeholder="Write your own, or start from one"
        className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mulberry"
      />
      <p data-pabuya-count="" className={`text-right text-[12px] ${remaining < 60 ? 'text-terracotta-700' : 'text-ink/50'}`}>
        {remaining} characters left
      </p>
      {refused ? (
        <p role="alert" data-pabuya-not-drafted="" className="flex flex-wrap items-center gap-x-2 text-[13px] text-terracotta-700">
          These words are not in your draft yet. {refused}
          <button type="button" onClick={() => draft(text)} className="min-h-11 font-semibold underline underline-offset-4">
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

/* ── THE E-GIFTS PAGE AND THE SHIPPED MAKER — as they were ──────────────── */

function ShippedEditor({ eventId, initialMessage, templates = PABUYA_TEMPLATES }: Props) {
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
