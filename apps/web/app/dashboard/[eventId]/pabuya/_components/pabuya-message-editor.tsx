'use client';

import { useState, useTransition } from 'react';

import { PABUYA_TEMPLATES, PABUYA_MESSAGE_MAX, type PabuyaTemplate } from '@/lib/pabuya-message';
import { savePabuyaMessage } from '../actions';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { useMaker } from '../../launch/_components/maker-context';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';

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
 * 🧭 In the new Maker's Studio (`stagesStudio`, owner 2026-10-08 studio round 3): the starting
 * points are ONE dropdown — "Start from ▾", exactly as Info's Opening line
 * (`opening-line-field.tsx`) — and the helper line sits behind ⓘ. Same box, same save; the
 * E-Gifts page keeps its chips until it is redrawn.
 */
export function PabuyaMessageEditor({
  eventId,
  initialMessage,
  templates = PABUYA_TEMPLATES,
}: {
  eventId: string;
  initialMessage: string | null;
  /** The starting points for this event's type (`pabuyaTemplatesFor`). Absent ⇒ the owner's five. */
  templates?: readonly PabuyaTemplate[];
}) {
  const [text, setText] = useState(initialMessage ?? '');
  const [saved, setSaved] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const maker = useMaker();
  const studio = maker?.stagesStudio === true;

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

      {studio ? (
        <div className="mt-4 flex min-h-11 items-center justify-between gap-3" data-pabuya-start="studio">
          <InfoTip label="Start from" labelClassName="text-[14px] text-ink" align="start">
            Pick one to fill the box, then change anything you like — what you save is your text, not the template.
          </InfoTip>
          <PickMenu
            label="Start from"
            dataAttr="data-pabuya-start-from"
            value={templates.find((t) => t.body === text)?.key ?? ''}
            buttonText={templates.find((t) => t.body === text)?.name ?? 'Start from'}
            options={templates.map((t) => ({ key: t.key, label: t.name, hint: t.body }))}
            onPick={(k) => {
              const t = templates.find((x) => x.key === k);
              if (t) setText(t.body);
            }}
            className="ring-1 ring-ink/10"
          />
        </div>
      ) : (
      <>
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
      </>
      )}

      <textarea
        value={text}
        /* In the Event Hub Maker's Details this box has two doors (Words ›
           Thank-you and The Finer Details' switch) — one value (`same-field.ts`). */
        data-same-field="pabuya_message"
        onChange={(e) => setText(e.target.value.slice(0, PABUYA_MESSAGE_MAX))}
        rows={4}
        placeholder={studio ? 'Write your own, or start from one' : 'Write your own, or pick one above…'}
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
