'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { Slider } from '@/app/_components/slider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  APP_COLOURS_DEFAULT,
  BAND_ANGLES,
  BAND_ANGLE_LABEL,
  FRAME_LIFTS,
  FRAME_LIFT_LABEL,
  FRAME_RADIUS_MAX,
  FRAME_RADIUS_MIN,
  JOB_NAME,
  LOOK_KIND_NAME,
  MOODS,
  TILE_KEYS,
  TILE_LABEL,
  appColoursEqual,
  applyFix,
  judgeAppColours,
  normaliseHex,
  shownRatio,
  type AppColours,
  type ColourCheck,
  type ColourFix,
  type ColourKey,
  type JobKey,
  type LookAlike,
  type TileKey,
  type TouchKey,
} from '@/lib/app-colours';
import type { ColoursActionState } from '../actions';
import { ColoursPreview, Sample } from './colours-sample';

/**
 * ADMIN › COLOURS — the editor. A port of the approved prototype (corpus `Design_App_Colours_2026-11-12/
 * app-colours-admin.html`): four moods, one row per JOB with its colour(s), a sample, and the readability line (with
 * the one-tap nearest readable shade), the "liveliness" switches, and a live preview of a couple's Home that repaints
 * as you go. Save is refused — here AND on the server, by the same `judgeAppColours` — while words would not read or
 * two button kinds look alike.
 *
 * House templates, not the prototype's hand-drawn controls: the hex is a Form row (`TypedRow`), Direction and Lift are
 * the one dropdown (`PickMenu`), Corners is the one `Slider`, the switches are `SwitchRow`, every button is an
 * `ActionButton`. The prototype's job cards are rows divided by a hairline (the no-card rule). Its "Preview on the
 * whole app" is not built in this update: the preview on this page is the draft; Save puts it on the app.
 */

const JOB_WHERE: Record<JobKey, string> = {
  page: 'Behind every screen. White by default; the band and frames carry the colour.',
  band: 'The coloured sweep at the top of a screen that holds the big number or the title.',
  frame: 'The white card every section sits in: its fill, how round its corners are, and how far it lifts off the page.',
  money:
    'Pay · Confirm · Hold the price — anything that commits money or an answer. On the band it is a white chip with this colour in its icon circle; in a frame it is filled.',
  decision: 'The forward step on a screen — Next, Start, Add, Publish. Same two forms: chip on the band, filled in a frame.',
  private: 'The 🔒 note only the couple sees: its box, bubble and strip. Words and wash follow from the one colour.',
  toggle: 'A switch that is on, a picked pill, the slider fill — anything that says “this one”.',
  tiles: 'The four category colours a frame marks rows with — a soft tinted square, a coloured glyph, a thin progress bar.',
};

/** Jobs saved now but drawn by a later update (band on the page tops, frames on the cards, icon tiles on the lists). */
const NEXT_UPDATE: ReadonlySet<JobKey> = new Set(['band', 'frame', 'tiles']);

const JOB_ORDER: readonly JobKey[] = ['page', 'band', 'frame', 'money', 'decision', 'private', 'toggle', 'tiles'];
const PICKERS: Record<JobKey, readonly { k: ColourKey; label: string }[]> = {
  page: [{ k: 'page', label: 'Page' }],
  band: [
    { k: 'bandFrom', label: 'From' },
    { k: 'bandTo', label: 'To' },
  ],
  frame: [{ k: 'frameFill', label: 'Fill' }],
  money: [{ k: 'money', label: 'Colour' }],
  decision: [{ k: 'decision', label: 'Colour' }],
  private: [{ k: 'private', label: 'Colour' }],
  toggle: [{ k: 'toggle', label: 'On' }],
  tiles: [],
};

const TOUCHES: readonly { k: TouchKey; name: string; line: string }[] = [
  { k: 'wave', name: 'Curved edge on the band', line: 'The band’s bottom edge bows softly instead of cutting straight across.' },
  { k: 'overlap', name: 'First frame overlaps the band', line: 'The top card rides up over the band’s edge, so the band and the page read as one surface.' },
  { k: 'press', name: 'Press ring', line: 'A press shows pressed at once (it always does); this adds a soft ring in the button’s own colour.' },
];

const LEGEND: Record<'money' | 'decision' | 'toggle' | 'private', string> = {
  money: 'Money',
  decision: 'Decision',
  toggle: 'Toggle on',
  private: 'Private',
};

const HEX_PROBLEM = `Write a colour as # and six digits — for example ${APP_COLOURS_DEFAULT.decision}.`;

function fixValues(fix: ColourFix): string[] {
  const { tiles, ...rest } = fix;
  const strings = (o: object) => Object.values(o).filter((v): v is string => typeof v === 'string');
  return [...strings(rest), ...strings(tiles ?? {})];
}

/** A colour picker: the swatch (the platform's colour input) and its hex as a Form row. */
function ColourField({ name, value, onSet }: { name: string; value: string; onSet: (hex: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative block h-11 w-11 flex-none overflow-hidden rounded-md border border-ink/15 shadow-[inset_0_0_0_2px_rgb(var(--color-raised))]">
        <span className="sr-only">{name} colour</span>
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => {
            const hex = normaliseHex(e.target.value);
            if (hex) onSet(hex);
          }}
          className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <FormRows width="short">
          <TypedRow
            name={name}
            value={value}
            maxLength={7}
            autoCapitalize="off"
            check={(t) => (normaliseHex(t) ? null : HEX_PROBLEM)}
            onType={(t) => {
              const hex = normaliseHex(t);
              if (hex) onSet(hex);
            }}
            onKeep={(t) => {
              const hex = normaliseHex(t);
              if (!hex) return { ok: false, error: HEX_PROBLEM };
              onSet(hex);
            }}
            data={`colour-${name.toLowerCase().replace(/\W+/g, '-')}`}
          />
        </FormRows>
      </div>
    </div>
  );
}

function CheckLine({ ch, onFix }: { ch: ColourCheck; onFix: (fix: ColourFix) => void }) {
  if (ch.pass) {
    return (
      <span>
        <span className="font-semibold text-success-800">Readable ✓</span>{' '}
        <span className="text-ink/60">
          {ch.label} {shownRatio(ch.ratio)}:1
        </span>
      </span>
    );
  }
  const values = ch.fix ? fixValues(ch.fix) : [];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={ch.soft ? 'font-semibold text-warn-700' : 'font-semibold text-danger-700'}>{ch.soft ? 'Faint' : 'Hard to read'}</span>
      <span className="text-ink/60">
        {ch.label} {shownRatio(ch.ratio)}:1, needs {ch.need}:1
      </span>
      {ch.fix ? (
        <ActionButton
          tone="ok"
          icon={<span aria-hidden className="inline-block h-3 w-3 rounded-full border border-ink/15" style={{ background: values[0] }} />}
          label={`Use ${values.join(' · ')}`}
          onClick={() => onFix(ch.fix!)}
        />
      ) : null}
    </span>
  );
}

function LookAlikeLine({ job, list }: { job: JobKey; list: readonly LookAlike[] }) {
  const mine = list.filter((l) => l.a === job || l.b === job);
  if (!mine.length) return null;
  const others = mine.map((l) => LOOK_KIND_NAME[l.a === job ? l.b : l.a]);
  const refuses = mine.some((l) => l.refuses);
  return (
    <span>
      <span className={refuses ? 'font-semibold text-danger-700' : 'font-semibold text-warn-700'}>Looks the same as {others.join(' and ')}</span>{' '}
      <span className="text-ink/60">— people will not tell them apart{refuses ? '; two buttons this alike will not save' : ''}</span>
    </span>
  );
}


export function ColoursEditor({
  action,
  initial,
}: {
  action: (prev: ColoursActionState, fd: FormData) => Promise<ColoursActionState>;
  initial: AppColours;
}) {
  const [draft, setDraft] = useState<AppColours>(initial);
  const [saved, setSaved] = useState<AppColours>(initial);
  const [said, setSaid] = useState<{ text: string; tone: 'quiet' | 'good' | 'bad' } | null>(null);
  const [state, formAction, pending] = useActionState<ColoursActionState, FormData>(action, { ok: false, message: null, saved: null });
  const lastOp = useRef<'save' | 'reset'>('save');

  const verdict = useMemo(() => judgeAppColours(draft), [draft]);
  const dirty = !appColoursEqual(draft, saved);

  /* A save answered: the "saved" baseline moves; a reset also brings the draft back to today's colours. */
  useEffect(() => {
    if (!state.message) return;
    if (state.ok && state.saved) {
      setSaved(state.saved);
      if (lastOp.current === 'reset') setDraft(state.saved);
    }
    setSaid({ text: state.message, tone: state.ok ? 'good' : 'bad' });
  }, [state]);

  const change = (next: AppColours, words = 'Changed. Not saved.') => {
    setDraft(next);
    setSaid({ text: words, tone: 'quiet' });
  };
  const setColour = (k: ColourKey, hex: string) => change({ ...draft, [k]: hex });
  const setTile = (k: TileKey, hex: string) => change({ ...draft, tiles: { ...draft.tiles, [k]: hex } });

  const firstRefusal = verdict.refusals[0] ?? null;
  const firstBadJob: JobKey | null =
    verdict.checks.find((c) => !c.pass && !c.soft)?.job ?? verdict.lookAlikes.find((l) => l.refuses)?.a ?? null;

  const bar = firstRefusal
    ? { text: `Cannot save: ${firstRefusal} Tap “Use …” on that row.`, tone: 'bad' as const }
    : said && (dirty || said.tone !== 'quiet')
      ? said
      : { text: dirty ? 'Changed. Not saved.' : 'Saved. Every screen except the guest Event Hub.', tone: 'quiet' as const };

  return (
    <div data-admin-colours="">
      <p className="mb-5 max-w-[64ch] text-sm text-ink/60">
        The page stays white. The life is in what sits on it: a coloured band at the top, white frames that float over it,
        and buttons that never look like frames. Pick a mood or tune each job; the preview repaints as you go. Words must
        stay readable or it will not save.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_410px]">
        <div className="min-w-0">
          <h2 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">Try a mood</h2>
          <div role="group" aria-label="Moods" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {MOODS.map((m) => {
              const on = appColoursEqual(m.colours, draft);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  data-mood={m.id}
                  onClick={() => change(m.colours, `${m.name} applied to the preview. Not saved.`)}
                  className={`flex flex-col gap-2 rounded-md border bg-raised p-2.5 text-left transition active:scale-[0.98] ${on ? 'border-sn-accent ring-2 ring-sn-accent/25' : 'border-ink/15'}`}
                >
                  <span
                    aria-hidden
                    className="relative block h-11 overflow-hidden rounded-md border border-black/5"
                    style={{ background: `linear-gradient(${m.colours.bandAngle}, ${m.colours.bandFrom}, ${m.colours.bandTo})` }}
                  >
                    <span className="absolute inset-x-2 -bottom-1.5 h-4 rounded-md bg-white shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]" />
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {m.name}
                    {on ? <span className="ml-auto text-[11px] font-semibold text-sn-accent">applied</span> : null}
                  </span>
                  <span aria-hidden className="flex gap-1">
                    {(['money', 'decision', 'toggle', 'private'] as const).map((k) => (
                      <i key={k} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: m.colours[k] }} />
                    ))}
                  </span>
                  <span className="text-[12px] leading-snug text-ink/60">{m.why}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">The jobs</h2>
          <div>
            {JOB_ORDER.map((job) => {
              const checks = verdict.checks.filter((c) => c.job === job);
              const bad =
                checks.some((c) => !c.pass && !c.soft) || verdict.lookAlikes.some((l) => l.refuses && (l.a === job || l.b === job));
              return (
                <section
                  key={job}
                  id={`colours-job-${job}`}
                  data-job={job}
                  data-bad={bad ? '' : undefined}
                  className="space-y-3 border-t border-ink/10 py-4 first:border-t-0"
                >
                  <div>
                    <h3 className={`text-[15px] font-semibold ${bad ? 'text-danger-700' : ''}`}>
                      {JOB_NAME[job]}
                      {NEXT_UPDATE.has(job) ? <span className="ml-2 text-[12px] font-medium text-ink/50">· applies in the next update</span> : null}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-ink/60">{JOB_WHERE[job]}</p>
                  </div>
                  {PICKERS[job].map((p) => (
                    <ColourField key={p.k} name={`${JOB_NAME[job]} · ${p.label}`} value={draft[p.k]} onSet={(hex) => setColour(p.k, hex)} />
                  ))}
                  {job === 'band' ? (
                    <PickMenu
                      label="Direction"
                      value={draft.bandAngle}
                      options={BAND_ANGLES.map((a) => ({ key: a, label: BAND_ANGLE_LABEL[a] }))}
                      onPick={(k) => change({ ...draft, bandAngle: k as AppColours['bandAngle'] })}
                      dataAttr="data-colours-direction"
                      className="w-full !min-h-11 sm:w-auto"
                    />
                  ) : null}
                  {job === 'frame' ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex min-w-[220px] flex-1 items-center gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">Corners</span>
                        <Slider
                          label="Corner radius"
                          value={draft.frameRadius}
                          min={FRAME_RADIUS_MIN}
                          max={FRAME_RADIUS_MAX}
                          step={2}
                          valueText={`${draft.frameRadius} pixels`}
                          onChange={(v) => change({ ...draft, frameRadius: v })}
                          data="colours-corners"
                        />
                        <span className="w-10 text-right font-mono text-[12px] text-ink/60">{draft.frameRadius}px</span>
                      </div>
                      <PickMenu
                        label="Lift"
                        value={draft.frameLift}
                        options={FRAME_LIFTS.map((l) => ({ key: l, label: FRAME_LIFT_LABEL[l] }))}
                        onPick={(k) => change({ ...draft, frameLift: k as AppColours['frameLift'] })}
                        dataAttr="data-colours-lift"
                        className="w-full !min-h-11 sm:w-auto"
                      />
                    </div>
                  ) : null}
                  {job === 'tiles' ? (
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      {TILE_KEYS.map((k) => (
                        <ColourField key={k} name={TILE_LABEL[k]} value={draft.tiles[k]} onSet={(hex) => setTile(k, hex)} />
                      ))}
                    </div>
                  ) : null}
                  <Sample job={job} d={draft} />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]" data-colours-checks={job}>
                    {checks.map((c, i) => (
                      <span key={c.label} className="inline-flex flex-wrap items-center gap-2">
                        {i > 0 ? <span className="text-ink/40">·</span> : null}
                        <CheckLine ch={c} onFix={(fix) => change(applyFix(draft, fix), 'Nearest readable shade applied. Not saved.')} />
                      </span>
                    ))}
                    {job === 'money' || job === 'decision' || job === 'private' || job === 'toggle' ? (
                      <LookAlikeLine job={job} list={verdict.lookAlikes} />
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          <h2 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-ink/50">
            Liveliness, beyond colour <span className="normal-case tracking-normal text-ink/45">· applies in the next update</span>
          </h2>
          <FormRows>
            {TOUCHES.map((t) => (
              <SwitchRow
                key={t.k}
                name={t.name}
                line={t.line}
                on={draft.touches[t.k]}
                onChange={(next) => change({ ...draft, touches: { ...draft.touches, [t.k]: next } })}
                data={`colours-touch-${t.k}`}
              />
            ))}
          </FormRows>
        </div>

        <div className="min-w-0 lg:sticky lg:top-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live preview · a couple’s Home</h2>
            <span className="text-[12px] text-ink/50">repaints as you change</span>
          </div>
          <ColoursPreview d={draft} />
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-ink/60" aria-hidden>
            <span>
              <i
                className="mr-1.5 inline-block h-2.5 w-[22px] rounded-sm align-[-1px]"
                style={{ background: `linear-gradient(90deg, ${draft.bandFrom}, ${draft.bandTo})` }}
              />
              Band {draft.bandFrom} → {draft.bandTo}
            </span>
            {(['money', 'decision', 'toggle', 'private'] as const).map((k) => (
              <span key={k}>
                <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[-1px]" style={{ background: draft[k] }} />
                {LEGEND[k]} {draft[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 bg-raised/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p
          role="status"
          aria-live="polite"
          data-colours-bar=""
          className={`min-w-0 flex-1 basis-full text-[13px] sm:basis-0 ${bar.tone === 'bad' ? 'font-medium text-danger-700' : bar.tone === 'good' ? 'font-medium text-success-800' : 'text-ink/60'}`}
        >
          {pending ? 'Saving…' : bar.text}
        </p>
        <form
          action={formAction}
          onSubmit={() => {
            lastOp.current = 'reset';
          }}
        >
          <input type="hidden" name="op" value="reset" />
          <ActionButton type="submit" tone="neutral" icon={RotateCcw} label="Reset to current" waiting={pending} />
        </form>
        <form
          action={formAction}
          onSubmit={(e) => {
            lastOp.current = 'save';
            if (!firstRefusal) return;
            e.preventDefault();
            setSaid({ text: `Not saved. ${firstRefusal}`, tone: 'bad' });
            if (firstBadJob) document.getElementById(`colours-job-${firstBadJob}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <input type="hidden" name="app_colours" value={JSON.stringify(draft)} />
          <ActionButton type="submit" tone="ok" main icon={Check} label="Save" waiting={pending} />
        </form>
      </div>
    </div>
  );
}
