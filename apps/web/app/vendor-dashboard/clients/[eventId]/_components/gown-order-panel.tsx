'use client';

/**
 * 👗 THE GOWN ON THE ORDER — the designer's view of a bride's sent design (gown maker port step B7; corpus
 * WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5; the approved drawing is `prototypes/gown_maker_2026-11-27/
 * gown_maker_v197.html` "Quotations and orders" and its pattern panel).
 *
 *   · Their design in words, and the estimate she saw (or "Ask for a quote"); the cost lines, priced now from the
 *     shop's own list (the shop only — computed on the server, never stored where she can read them).
 *   · Her numbers, each tagged: hers, or the mannequin's estimate. Her bra size and what matters to her.
 *   · The gown's measurements: hers or the estimate, with the designer's tape beside each. **Save tape** stores them
 *     (`gown_fittings`, the shop only).
 *   · **Cutting blocks**: starting blocks from her numbers, the tape over both. "ESTIMATE: measure before cutting"
 *     whenever a number on a block is an estimate. Designer only; no price on any sheet.
 *
 * "Open on the mannequin" comes with Builder A's step A8 (never a dead control before then).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCw, Ruler, Save } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { gownDesignWords } from '@/lib/gown-maker';
import { GOWN_BODY_KEYS, GOWN_MATTERS, GOWN_MEASURES, GOWN_STEP_LABELS, gownMeasuresNeeded, type GownBody, type GownConfig, type GownMeasureKey, type GownMeasures } from '@/lib/gown-config';
import { GOWN_DRAFT_ESTIMATE, GOWN_DRAFT_FROM_MEMORY, GOWN_DRAFT_TOLERANCE_CM } from '@/lib/gown-pattern/draft-constants';
import type { GownDesignRead } from '@/app/_components/gown-maker/gown-actions';
import { gownAction } from '@/app/_components/gown-maker/gown-call';

/**
 * Her number in the unit a designer measures in. Arm and leg are stored as PROPORTIONS of her height (v186: arm =
 * value × 0.3 × height, leg = value × 0.525 × height — `GOWN_BODY_RANGE`), so they read in cm, marked "about".
 */
function bodyNumber(k: (typeof GOWN_BODY_KEYS)[number], vals: GownBody['vals']): string {
  if (k === 'weight') return `${vals.weight} kg`;
  if (k === 'arm') return `about ${Math.round(vals.arm * 0.3 * vals.height)} cm`;
  if (k === 'leg') return `about ${Math.round(vals.leg * 0.525 * vals.height)} cm`;
  return `${vals[k]} cm`;
}

type Load = { s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; d: GownDesignRead };

export function GownOrderPanel({ threadId, messageId, seed }: { threadId: string; messageId: string; seed?: GownDesignRead }) {
  const [load, setLoad] = useState<Load>(seed ? { s: 'ok', d: seed } : { s: 'loading' });
  const read = useCallback(() => {
    setLoad({ s: 'loading' });
    gownAction({ op: 'design', threadId, messageId })
      .then((r) => setLoad(r.ok && r.op === 'design' ? { s: 'ok', d: r } : { s: 'failed', message: r.ok ? 'Couldn’t read this design.' : r.message }))
      .catch(() => setLoad({ s: 'failed', message: 'Couldn’t read this design.' }));
  }, [threadId, messageId]);
  useEffect(() => {
    if (!seed) read();
  }, [read, seed]);

  if (load.s === 'loading') return <div className="sn-frame skeleton h-64" aria-busy="true" data-gown-order="loading" />;
  if (load.s === 'failed') {
    return (
      <div className="sn-frame space-y-2 p-4" role="alert" data-gown-order="failed">
        <p className="text-sn-md font-semibold text-ink">Couldn’t read her gown design</p>
        <p className="text-sn-base text-ink/70">{load.message} Nothing was changed.</p>
        <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={read} />
      </div>
    );
  }
  const d = load.d;
  if (!d.config || !d.body) {
    return (
      <p className="sn-frame p-4 text-sn-base text-ink/70" data-gown-order="unreadable">
        This design can’t be opened: it was sent without its numbers.
      </p>
    );
  }
  return <Order d={d} config={d.config as GownConfig} body={d.body} threadId={threadId} />;
}

function Order({ d, config, body, threadId }: { d: GownDesignRead; config: GownConfig; body: GownBody; threadId: string }) {
  const toast = useToast();
  const [tape, setTape] = useState<Partial<Record<GownMeasureKey, number>>>({ ...(d.tape?.tape ?? {}) });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const needed = useMemo(() => gownMeasuresNeeded(config), [config]);
  const measures: GownMeasures = d.measures ?? {};
  const braLine = `Bra size: ${body.bra ? `${body.bra.us} US · ${body.bra.eu} EU${body.bra.exact ? '' : ' (estimate)'}` : 'Couldn’t read it from her numbers'}`;
  const mattersLine = body.matters.length ? `What matters to her: ${body.matters.map((m) => GOWN_MATTERS.find((x) => x.id === m)?.label ?? m).join(', ')}` : null;

  const saveTape = async () => {
    setSaving(true);
    setProblem(null);
    const r = await gownAction({ op: 'fit', threadId, designId: d.designId, tape });
    setSaving(false);
    if (r.ok) toast.success('Tape saved');
    else {
      setProblem(r.message);
      toast.error(r.message);
    }
  };

  return (
    <div className="space-y-5" data-gown-order="ok">
      <section className="sn-frame space-y-1 p-4">
        <p className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Her design</p>
        <p className="text-sn-lg font-semibold text-ink">{gownDesignWords(config)}</p>
        <p className="text-sn-base text-ink/70">
          {d.estimateCentavos != null ? `She saw an estimate of ${formatCentavosPhp(d.estimateCentavos)}.` : 'She asked for a quote.'}
          {d.replaced ? ' She sent a newer design after this one.' : ''}
        </p>
      </section>

      {d.forShop ? (
        <section className="space-y-1" data-gown-order-costs="">
          <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Your costs (only you see these)</h3>
          {d.forShop.lines.length ? null : <p className="text-sn-base text-ink/70">No cost lines for this design yet.</p>}
          <ul className={d.forShop.lines.length ? 'sn-frame divide-y divide-line' : 'hidden'}>
            {d.forShop.lines.map((l, i) => (
              <li key={`${l.key}-${i}`} className="flex items-baseline justify-between gap-3 p-3 text-sn-base">
                <span className="min-w-0 text-ink">
                  {l.label}
                  <small className="block text-ink/70">
                    {l.group} · {formatCount(l.qty)} {l.unit}
                  </small>
                </span>
                <span className="text-ink/80">{l.included ? 'Included' : l.amountCentavos == null ? 'Not priced' : formatCentavosPhp(l.amountCentavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sn-base text-ink/70" data-gown-order-costs="unread">
          Couldn’t price this from your list just now. Open Shop › Attire Maker to check it.
        </p>
      )}

      <section className="space-y-1" data-gown-order-body="">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Her numbers</h3>
        <ul className="sn-frame divide-y divide-line">
          {GOWN_BODY_KEYS.map((k) => (
            <li key={k} className="flex items-baseline justify-between gap-3 p-3 text-sn-base">
              <span className="text-ink">{GOWN_STEP_LABELS[k]}</span>
              <span className="text-ink/80">
                {bodyNumber(k, body.vals)} <small className="text-ink/60">{body.given.includes(k) ? 'hers' : 'estimate'}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sn-base text-ink/70">{braLine}</p>
        {mattersLine ? <p className="text-sn-base text-ink/70">{mattersLine}</p> : null}
      </section>

      <section className="space-y-1" data-gown-order-tape="">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">The gown’s measurements</h3>
        <p className="text-sn-base text-ink/70">Hers or the estimate on the left; your tape at the fitting beside it.</p>
        <FormRows>
          {GOWN_MEASURES.filter((m) => needed.includes(m.id)).map((m) => {
            const hers = measures[m.id];
            return (
              <TypedRow
                key={m.id}
                name={m.label}
                value={tape[m.id] ? String(tape[m.id]) : ''}
                empty="Your tape"
                inputMode="numeric"
                onKeep={(v) => {
                  const n = Number(v.replace(',', '.'));
                  setTape((p) => {
                    const next = { ...p };
                    if (n > 0) next[m.id] = Math.round(n * 10) / 10;
                    else delete next[m.id];
                    return next;
                  });
                }}
                note={hers ? `${hers.from === 'estimate' ? 'Estimate' : 'Hers'}: ${hers.cm} cm` : 'Not given yet'}
                data="gown-tape"
                attrs={{ 'data-gown-tape': m.id }}
              />
            );
          })}
        </FormRows>
        {problem ? (
          <p role="alert" className="text-sn-base font-semibold text-danger-700">
            {problem}
          </p>
        ) : null}
        <ActionButton tone="brand" icon={Save} label={saving ? 'Saving…' : 'Save tape'} onClick={saveTape} disabled={saving} className="w-full" data-gown-tape-save="" />
      </section>

      <section className="space-y-2" data-gown-order-blocks="">
        <ActionButton tone="neutral" icon={Ruler} label={blocksOpen ? 'Hide the cutting blocks' : 'Cutting blocks'} onClick={() => setBlocksOpen((o) => !o)} className="w-full" />
        {blocksOpen ? <Blocks config={config} body={body} measures={measures} tape={tape} /> : null}
      </section>
    </div>
  );
}

function Blocks({ config, body, measures, tape }: { config: GownConfig; body: GownBody; measures: GownMeasures; tape: Partial<Record<GownMeasureKey, number>> }) {
  const [svgs, setSvgs] = useState<{ est: boolean; parts: { title: string; svg: string | null; error: string | null; checks: readonly (readonly [string, number, number])[] }[] } | null>(null);
  useEffect(() => {
    let live = true;
    // The engine loads only when the designer opens the blocks.
    void Promise.all([import('@/lib/gown-pattern/order'), import('@/lib/gown-pattern/svg')]).then(([{ gownOrderBlocks }, { gownBlocksSvg }]) => {
      const b = gownOrderBlocks(config, body, measures, tape);
      const part = (title: string, d: typeof b.skirt | typeof b.bodice) =>
        d.ok ? { title, svg: gownBlocksSvg(d.pieces, title), error: null, checks: d.checks } : { title, svg: null, error: d.error, checks: [] };
      if (live) setSvgs({ est: b.est, parts: [part('Bodice blocks', b.bodice), part('Skirt blocks', b.skirt)] });
    });
    return () => {
      live = false;
    };
  }, [config, body, measures, tape]);
  if (!svgs) return <div className="sn-frame skeleton h-48" aria-busy="true" />;
  return (
    <div className="space-y-3" data-gown-blocks="">
      {svgs.est ? (
        <p role="note" className="text-sn-base font-semibold text-danger-700" data-gown-blocks-estimate="">
          {GOWN_DRAFT_ESTIMATE}
        </p>
      ) : null}
      <p className="text-sn-base text-ink/70">{GOWN_DRAFT_FROM_MEMORY}</p>
      {svgs.parts.map((p) => (
        <div key={p.title} className="sn-frame space-y-2 p-3">
          <p className="text-sn-md font-semibold text-ink">{p.title}</p>
          {p.svg ? (
            // Our own drawing of the blocks (numbers only, one ink: currentColor), made by lib/gown-pattern/svg.ts.
            <div className="overflow-x-auto text-ink [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: p.svg }} />
          ) : (
            <p className="text-sn-base text-ink/70">{p.error}</p>
          )}
          {p.checks.length ? (
            <ul className="text-sn-sm text-ink/70">
              {p.checks.map(([what, asked, drawn]) => (
                <li key={what}>
                  {Math.abs(drawn - asked) <= GOWN_DRAFT_TOLERANCE_CM ? '✓' : '⚠'} {what}: {formatCount(asked, 1)} / {formatCount(drawn, 1)} cm
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
