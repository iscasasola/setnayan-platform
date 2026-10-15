/**
 * 🚶 A DRAG ON THE WEDDING MARCH NEVER LOSES ANYONE (owner, verbatim, 2026-10-14: *"while dragging a name in wedding march
 * now, we lost Bridgette for a while. needed to undo to find her back."*).
 *
 * PROPERTY-STYLE, over thousands of seeded random drags — every source the march draws (a name, a walk's number, a section's
 * header, a "Not walking" chip) dropped on every kind of target it has (a name, the empty place beside a lone walker, a gap,
 * a header, the tray) — on maria-and-jose's lab march AND the owner-shaped one (45 walks · 80 walking, tied walks, a person
 * with two roles). After EVERY drop, the people are the same set — each exactly once, walking or not walking:
 *   · in what the drop draws at once (`planMove`), planned on what the Maker last drew — the drop's own picture, or the
 *     draft as the server lays it back (`replayMarch`) after the Maker's re-read, chosen at random as a burst would;
 *   · in the draft as the server lays it back (`replayMarch` over every drafted step, from the live march);
 *   · after the toast's Undo (the last drafted move taken back off).
 *
 * SABOTAGE (seen red, then restored — controller-2026-10-12/march-keep/sabotage-out.txt).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { labMarchSections } from '@/app/dev/details-lab/march-fixture';
import { acrossTheAisle, planMove, replayMarch, type MarchShown, type MarchSource, type MarchStep, type MarchTarget } from './march-drag';

const everyone = (m: MarchShown): string[] => {
  const ids: string[] = [];
  for (const s of m.sections) for (const r of s.rows) for (const p of r) if (p) ids.push(p.id);
  for (const o of m.out) ids.push(o.id);
  return ids.sort();
};

/** Every source and every target the march draws right now. */
function options(m: MarchShown): { src: MarchSource[]; tgt: MarchTarget[] } {
  const src: MarchSource[] = [];
  const tgt: MarchTarget[] = [{ kind: 'tray' }];
  for (const s of m.sections) {
    src.push({ kind: 'section', key: s.key });
    tgt.push({ kind: 'section', key: s.key });
    for (let i = 0; i <= s.rows.length; i++) tgt.push({ kind: 'gap', section: s.key, index: i });
    for (const r of s.rows) {
      src.push({ kind: 'walk', section: s.key, lead: (r[0] ?? r[1])!.id });
      for (const p of r) if (p) {
        src.push({ kind: 'name', id: p.id });
        tgt.push({ kind: 'name', id: p.id });
      }
      const laid = acrossTheAisle(r);
      if (!laid[0] || !laid[1]) tgt.push({ kind: 'beside', anchor: (laid[0] ?? laid[1])!.id });
    }
  }
  for (const o of m.out) src.push({ kind: 'out', id: o.id });
  return { src, tgt };
}

for (const shape of ['maria-and-jose', 'owner'] as const) {
  test(`${shape}: thousands of random drags — nobody is ever lost or drawn twice, at the drop, in the draft, after Undo`, () => {
    let seed = 20261014;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
    const live = labMarchSections(shape === 'owner' ? 'owner' : undefined) as MarchShown;
    const all = everyone(live);
    assert.ok(all.length >= (shape === 'owner' ? 70 : 30), `the fixture has ${all.length} people`);
    assert.equal(new Set(all).size, all.length, 'the fixture draws someone twice');
    let drops = 0;
    for (let run = 0; run < 400; run++) {
      let shown = live;
      const drafted: MarchStep[][] = [];
      for (let k = 0; k < 40; k++) {
        const { src, tgt } = options(shown);
        const plan = planMove(shown.sections, shown.printed, pick(src), pick(tgt), shown.out);
        if (!plan || !plan.ok) continue;
        drops += 1;
        const drawn: MarchShown = { sections: plan.sections, printed: plan.printed, out: plan.out ?? shown.out };
        assert.deepEqual(everyone(drawn), all, `a drop drew a different set of people (run ${run}, drop ${k})`);
        drafted.push(plan.steps);
        const server = replayMarch(live, drafted.flat());
        assert.deepEqual(everyone(server), all, `the draft, laid back by the server, lost or doubled someone (run ${run}, drop ${k})`);
        const undone = replayMarch(live, drafted.slice(0, -1).flat());
        assert.deepEqual(everyone(undone), all, `Undo lost or doubled someone (run ${run}, drop ${k})`);
        // The next drop is planned on what the Maker draws next: its own picture (a burst), or the server's (after the re-read).
        shown = rnd() < 0.5 ? drawn : server;
      }
    }
    assert.ok(drops > 1000, `only ${drops} drops landed — the fuzz is not reaching the march`);
  });
}
