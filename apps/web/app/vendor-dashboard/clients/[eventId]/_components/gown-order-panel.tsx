'use client';

/**
 * 👗 THE GOWN ON THE ORDER — the designer's view of a bride's sent design (gown maker port step B7; corpus
 * WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5; the approved drawing is `prototypes/gown_maker_2026-11-27/
 * gown_maker_v197.html` "Quotations and orders" and its pattern panel; the blocks, allowances, cutting list and export are
 * v205's — steps B11/B12, owner D28–D30).
 *
 *   · Their design in words, and the estimate she saw (or "Ask for a quote"); the cost lines, priced now from the
 *     shop's own list (the shop only — computed on the server, never stored where she can read them).
 *   · Her numbers, each tagged: hers, or the mannequin's estimate. Her bra size and what matters to her.
 *   · The gown's measurements: hers or the estimate, with the designer's tape beside each. **Save tape** stores them
 *     (`gown_fittings`, the shop only).
 *   · **Cutting blocks**: starting blocks from her numbers, the tape over both. "ESTIMATE: measure before cutting"
 *     whenever a number on a block is an estimate. Designer only; no price on any sheet.
 *   · **Seam allowance** (on by default, from the shop's own; this order may set its own, or go back to the shop's)
 *     and **Net pattern**: the cut line dashed and mitred round the stitching line, notches, PLACE ON FOLD. Saved by
 *     themselves into the shop-only fitting row (`fit` with `pattern`).
 *   · **Cutting list**: every piece in every fabric, the metres checked against her quote (a gap over 10 % says why).
 *   · **Export 1:1**: the pattern pages (gown-pattern-pages.tsx) on A4 or US Letter, starting from the shop's paper.
 *
 * "Open on the mannequin" comes with Builder A's step A8 (never a dead control before then).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, RotateCcw, RotateCw, Ruler, Save } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { GOWN_HAND_NOT_SENT, GOWN_HAND_UNREAD, GOWN_ORDER_PATTERN_DEFAULT, gownDesignWords, gownHandLine, gownPatternState, type GownOrderPattern } from '@/lib/gown-maker';
import { GOWN_BODY_KEYS, GOWN_MATTERS, GOWN_MEASURES, GOWN_STEP_LABELS, gownMeasuresNeeded, type GownBody, type GownConfig, type GownMeasureKey, type GownMeasures } from '@/lib/gown-config';
import { GOWN_DRAFT_ESTIMATE, GOWN_DRAFT_FROM_MEMORY, GOWN_DRAFT_TOLERANCE_CM } from '@/lib/gown-pattern/draft-constants';
import type { GownDesignRead } from '@/app/_components/gown-maker/gown-actions';
import type { GownTape } from '@/lib/gown-pattern/inputs';
import type { GownBlockPiece } from '@/lib/gown-pattern/skirt';
import type { GownPaper } from '@/lib/gown-pattern/export';
import { GOWN_EXPORT_HINT, GOWN_PAPER_OPTIONS, GOWN_PATTERN_UNREAD } from '@/lib/gown-pattern/words';
import { GOWN_SEAM_ALLOW_DEFAULT } from '@/lib/gown-pattern/allowance';
import { GOWN_LINES_UNREAD, gownLinesSummary } from '@/lib/gown-pattern/lines';
import { GOWN_CUT_LIST_HINT, gownCutCheckSentence, type GownCutList, type GownCutPart } from '@/lib/gown-pattern/cutting-list';
import { GownSeamAllowRows } from '@/app/vendor-dashboard/shop/_components/gown-seam-allow';
import { GownPatternPages } from './gown-pattern-pages';
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

export function GownOrderPanel({ threadId, messageId, seed, who = 'Client' }: { threadId: string; messageId: string; seed?: GownDesignRead; who?: string }) {
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
  return <Order d={d} config={d.config as GownConfig} body={d.body} threadId={threadId} who={who} />;
}

function Order({ d, config, body, threadId, who }: { d: GownDesignRead; config: GownConfig; body: GownBody; threadId: string; who: string }) {
  const toast = useToast();
  const [tape, setTape] = useState<Partial<Record<GownMeasureKey, number>>>({ ...(d.tape?.tape ?? {}) });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const needed = useMemo(() => gownMeasuresNeeded(config), [config]);
  const measures: GownMeasures = d.measures ?? {};
  const braLine = `Bra size: ${body.bra ? `${body.bra.us} US · ${body.bra.eu} EU${body.bra.exact ? '' : ' (estimate)'}` : 'Couldn’t read it from her numbers'}`;
  // A7b: her hand work, said once — counted into the bead and lace lines, not sent, or couldn't be read.
  const handLine = d.hand.s === 'sent' ? gownHandLine(d.hand.hand) : d.hand.s === 'none' ? GOWN_HAND_NOT_SENT : GOWN_HAND_UNREAD;
  // B9 (v209): her own lines, as a designer measures them; only what she changed from a named line is said.
  const L = d.pattern?.lines;
  const linesSaid = L?.s === 'sent' ? gownLinesSummary(L.edges, config.neck === 'high') : L?.s === 'unread' ? [GOWN_LINES_UNREAD] : [];
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
        {handLine ? (
          <p className="text-sn-base text-ink/70" data-gown-order-hand={d.hand.s}>
            {handLine}
          </p>
        ) : null}
        {linesSaid.map((line) => (
          <p key={line} className="text-sn-base text-ink/70" data-gown-order-lines={L?.s}>
            {line}
          </p>
        ))}
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
        {blocksOpen ? <Pattern d={d} config={config} body={body} measures={measures} tape={tape} threadId={threadId} who={who} /> : null}
      </section>
    </div>
  );
}

type Part = { title: string; svg: string | null; error: string | null; checks: readonly (readonly [string, number, number])[] };
type Drawn = { est: boolean; parts: Part[]; cut: { p: GownBlockPiece; part: GownCutPart }[]; cutList: GownCutList | null };

/**
 * The cutting blocks, their seam allowances and the 1:1 export (B11/B12, drawing v205 `blocksHTML`). The allowances
 * start from the shop's own; a change here is this order's own and saves itself (`fit` with `pattern`, the shop only).
 */
function Pattern({ d, config, body, measures, tape, threadId, who }: { d: GownDesignRead; config: GownConfig; body: GownBody; measures: GownMeasures; tape: GownTape; threadId: string; who: string }) {
  const toast = useToast();
  const P = d.pattern;
  const [order, setOrder] = useState<GownOrderPattern>(P?.order ?? { ...GOWN_ORDER_PATTERN_DEFAULT });
  const [paper, setPaper] = useState<GownPaper>(P?.paper ?? 'a4');
  const [pages, setPages] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (wait.current && clearTimeout(wait.current)), []);
  // Without the shop's settings the cut line cannot be drawn honestly: the stitching line only, and it says why.
  const net = P ? order.netPattern : true;
  const sa = useMemo(() => (P ? (order.seamAllow ?? P.shop) : GOWN_SEAM_ALLOW_DEFAULT), [P, order.seamAllow]);

  const change = (next: GownOrderPattern) => {
    setOrder(next);
    setProblem(null);
    if (wait.current) clearTimeout(wait.current);
    wait.current = setTimeout(async () => {
      const r = await gownAction({ op: 'fit', threadId, designId: d.designId, pattern: next }).catch(() => null);
      if (r?.ok) return;
      const why = r && !r.ok ? r.message : 'The seam allowances didn’t save. Try again.';
      setProblem(why);
      toast.error(why);
    }, 600);
  };

  const [drawn, setDrawn] = useState<Drawn | null>(null);
  useEffect(() => {
    let live = true;
    // The engine loads only when the designer opens the blocks.
    void Promise.all([import('@/lib/gown-pattern/order'), import('@/lib/gown-pattern/svg'), import('@/lib/gown-pattern/cutting-list')]).then(([{ gownOrderBlocks }, { gownBlocksSvg }, { gownCutList }]) => {
      const b = gownOrderBlocks(config, body, measures, tape, P?.lines.s === 'sent' ? P.lines.edges : null);
      const part = (title: string, x: typeof b.skirt | typeof b.bodice | typeof b.sleeve): Part =>
        x.ok ? { title, svg: gownBlocksSvg(x.pieces, title, sa, net), error: null, checks: x.checks } : { title, svg: null, error: x.error, checks: [] };
      const sleeve = b.sleeve.ok && b.sleeve.pieces.length === 0 ? [] : [part('Sleeve block', b.sleeve)];
      // The cutting list and the pages hold the bodice and the skirt, as the drawing does.
      const cut = [...(b.bodice.ok ? b.bodice.pieces.map((p) => ({ p, part: 'bodice' as const })) : []), ...(b.skirt.ok ? b.skirt.pieces.map((p) => ({ p, part: 'skirt' as const })) : [])];
      const cutList = P && cut.length ? gownCutList(cut, P.cut, sa, net) : null;
      if (live) setDrawn({ est: b.est, parts: [part('Bodice blocks', b.bodice), ...sleeve, part('Skirt blocks', b.skirt)], cut, cutList });
    });
    return () => {
      live = false;
    };
  }, [config, body, measures, tape, sa, net, P]);

  return (
    <div className="space-y-4" data-gown-pattern="">
      {P ? (
        <div className="space-y-2" data-gown-pattern-controls="">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Seam allowance</h3>
            <span className="text-sn-sm text-ink/70" data-gown-pattern-state="">
              {gownPatternState(order)}
            </span>
          </div>
          <GownSeamAllowRows value={sa} onChange={(next) => change({ ...order, seamAllow: next })} disabled={order.netPattern} data="order" />
          {order.seamAllow && !order.netPattern ? (
            <ActionButton tone="neutral" icon={RotateCcw} label="Use my shop’s allowances" onClick={() => change({ ...order, seamAllow: null })} data-gown-pattern-reset="" />
          ) : null}
          <FormRows>
            <SwitchRow name="Net pattern" line="Shows the stitching line only, no cut line." on={order.netPattern} onChange={(on) => change({ ...order, netPattern: on })} data="gown-net-pattern" />
          </FormRows>
          {problem ? (
            <p role="alert" className="text-sn-base font-semibold text-danger-700">
              {problem}
            </p>
          ) : null}
        </div>
      ) : (
        <p role="alert" className="text-sn-base text-ink/70" data-gown-pattern-controls="unread">
          {GOWN_PATTERN_UNREAD}
        </p>
      )}

      {!drawn ? (
        <div className="sn-frame skeleton h-48" aria-busy="true" />
      ) : (
        <div className="space-y-3" data-gown-blocks="">
          <p role="note" className="sn-frame p-3 text-sn-base font-semibold text-danger-700">
            {GOWN_DRAFT_FROM_MEMORY}
          </p>
          {drawn.est ? (
            <p role="note" className="sn-frame p-3 text-sn-base font-semibold text-danger-700" data-gown-blocks-estimate="">
              {GOWN_DRAFT_ESTIMATE}
            </p>
          ) : null}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sn-sm text-ink/70" data-gown-pattern-key="">
            {net ? (
              <span>— Stitching line (net: add your own allowance)</span>
            ) : (
              <>
                <span>— Stitching line</span>
                <span>- - - Cut line</span>
                <span>| Notch</span>
              </>
            )}
          </p>
          {drawn.parts.map((p) => (
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
                  {p.checks.map(([what, asked, made]) => (
                    <li key={what}>
                      {Math.abs(made - asked) <= GOWN_DRAFT_TOLERANCE_CM ? '✓' : '⚠'} {what}: {formatCount(asked, 1)} / {formatCount(made, 1)} cm
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {drawn.cutList ? <CutList c={drawn.cutList} /> : null}
          {P && drawn.cut.length ? (
            <div className="space-y-2" data-gown-export="">
              <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Print at full size</h3>
              <FormRows>
                <ChosenRow name="Paper" value={paper} options={GOWN_PAPER_OPTIONS} onPick={(k) => setPaper(k === 'letter' ? 'letter' : 'a4')} data="gown-export-paper" />
              </FormRows>
              <ActionButton tone="brand" icon={Printer} label="Export 1:1" onClick={() => setPages(true)} className="w-full" data-gown-export-open="" />
              <p className="text-sn-base text-ink/70">{GOWN_EXPORT_HINT}</p>
            </div>
          ) : null}
        </div>
      )}
      {pages && drawn ? <GownPatternPages pieces={drawn.cut.map((x) => x.p)} sa={sa} net={net} paper={paper} who={who} onClose={() => setPages(false)} /> : null}
    </div>
  );
}

const cm1 = (x: number) => x.toFixed(1);

/** v205 `patCutListHTML`: grouped by fabric; a table on a wide screen, stacked rows on a phone; the metres checked. */
function CutList({ c }: { c: GownCutList }) {
  const groups = [...new Set(c.rows.map((r) => r.fabric))];
  return (
    <div className="space-y-2" data-gown-cut-list="">
      <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Cutting list</h3>
      <div className="sn-frame p-3">
        <table className="w-full text-left text-sn-sm">
          <thead className="hidden md:table-header-group">
            <tr className="text-ink/70">
              <th className="py-1 pr-2 font-semibold">Piece</th>
              <th className="py-1 pr-2 font-semibold">Cut</th>
              <th className="py-1 pr-2 font-semibold">Fold</th>
              <th className="py-1 pr-2 font-semibold">Grain</th>
              <th className="py-1 pr-2 font-semibold">Fabric</th>
              <th className="py-1 font-semibold">Size{c.net ? ' (net)' : ' with allowance'}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g} data-gown-cut-fabric={g}>
              <tr>
                <th colSpan={6} className="border-b border-ink pb-1 pt-3 text-sn-base font-semibold text-ink">
                  {g}
                </th>
              </tr>
              {c.rows
                .filter((r) => r.fabric === g)
                .map((r) => (
                  <tr key={`${g}-${r.piece}`} className="flex flex-wrap gap-x-3 border-b border-line py-2 text-ink md:table-row" data-gown-cut-row={r.k}>
                    <td className="basis-full font-semibold md:py-2 md:pr-2">
                      {r.piece}
                      {r.note ? <small className="block font-normal text-ink/70">{r.note}</small> : null}
                    </td>
                    <td className="md:py-2 md:pr-2">
                      <span className="text-ink/70 md:hidden">Cut: </span>
                      {r.qty}
                    </td>
                    <td className="md:py-2 md:pr-2">
                      <span className="text-ink/70 md:hidden">Fold: </span>
                      {r.fold ? 'On the fold' : 'No'}
                    </td>
                    <td className="basis-full md:py-2 md:pr-2">
                      <span className="text-ink/70 md:hidden">Grain: </span>
                      {r.grain}
                    </td>
                    <td className="hidden md:table-cell md:py-2 md:pr-2">{r.fabric}</td>
                    <td className="basis-full md:py-2">
                      <span className="text-ink/70 md:hidden">Size: </span>
                      {cm1(r.w)} × {cm1(r.h)} cm
                      {r.fold ? <small className="block text-ink/70">opens to {cm1(2 * r.w)} cm across</small> : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="space-y-1" data-gown-cut-checks="">
        {c.checks.map((k) => {
          const w = gownCutCheckSentence(k);
          return (
            <p key={k.k} className={k.ok === false ? 'sn-frame p-2 text-sn-base text-ink' : 'text-sn-base text-ink'} data-gown-cut-check={k.k} data-ok={String(k.ok)}>
              {w.lead} {w.why ? <span className="text-ink/70">{w.why}</span> : null}
            </p>
          );
        })}
        <p className="text-sn-base text-ink/70">
          {GOWN_CUT_LIST_HINT}
          {c.unblocked.length ? ` Not in this list yet (no block): ${c.unblocked.join(', ')}.` : ''}
        </p>
      </div>
    </div>
  );
}
