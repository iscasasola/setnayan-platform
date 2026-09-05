import Link from 'next/link';
import { Eye, PencilLine } from 'lucide-react';
import type { HubFact } from '@/lib/event-hub-control';
import type { Plan3dStanding } from '@/lib/plan3d-control';
import { OB } from '@/app/dashboard/[eventId]/launch/_components/hub-stage';

/**
 * S1 · THE STAGE and S2 · THE FOUR FACTS for the 3D Plan — a living top-down
 * miniature of the room the couple built, drawn from the seat plan, with the
 * facts fused to its lower edge. The Event Hub's `HubStage` is the sibling and
 * the `OB` obsidian tokens are imported from it, not copied: this panel is
 * obsidian in BOTH themes and the app is light-locked (see hub-stage.tsx).
 *
 * PURE and presentational — every decision arrives already made from
 * `lib/plan3d-control.ts`, so `plan3d-stage-renders.test.ts` can mount it and
 * read the HTML. The disease this exists to fix is a measurement that never
 * reaches the pixel: a refused read must render as "—" and "could not read",
 * never as an empty room or a draft.
 *
 * ⚠ EMPTY IS A PROMISE, NOT AN APOLOGY (design § 4.4). A seat plan with no
 * tables shows the dashed room it will become plus the one act that starts
 * filling it — never a sentence apologising for being empty.
 */

export type StageTable = { x: number; y: number; kind: string };
export type StageBooth = { x: number; y: number; branded: boolean };
export type StageMiniature = {
  tables: StageTable[];
  stage: { x: number; y: number; w: number; h: number };
  dance: { enabled: boolean; x: number; y: number; w: number; h: number };
  entrance: { enabled: boolean; x: number; y: number };
  booths: StageBooth[];
};

function Miniature({ m, measured }: { m: StageMiniature | null; measured: boolean }) {
  if (!measured || !m) {
    return (
      <div className="flex aspect-[5/3] items-center justify-center rounded-xl" style={{ backgroundColor: OB.card }}>
        <p className="px-6 text-center text-sm" style={{ color: OB.soft }}>
          We couldn’t read your room just now.
        </p>
      </div>
    );
  }
  const empty = m.tables.length === 0;
  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 60"
        role="img"
        aria-label={empty ? 'Your room, once you place the first table' : `${m.tables.length} tables, drawn from your seat plan`}
        className="block aspect-[5/3] w-full rounded-xl"
        style={{ backgroundColor: OB.card }}
      >
        <rect x="2" y="2" width="96" height="56" rx="2" fill="none" stroke={OB.hairline} strokeWidth="0.6" strokeDasharray={empty ? '2 1.5' : undefined} />
        <rect x={m.stage.x - m.stage.w / 2} y={(m.stage.y - m.stage.h / 2) * 0.6} width={m.stage.w} height={m.stage.h * 0.6} rx="1" fill={OB.gold} fillOpacity={empty ? 0.25 : 0.55} />
        {m.dance.enabled ? (
          <rect x={m.dance.x - m.dance.w / 2} y={(m.dance.y - m.dance.h / 2) * 0.6} width={m.dance.w} height={m.dance.h * 0.6} rx="1" fill="none" stroke={OB.soft} strokeOpacity="0.5" strokeWidth="0.5" />
        ) : null}
        {m.entrance.enabled ? <rect x={m.entrance.x - 2.5} y={m.entrance.y * 0.6 - 0.8} width="5" height="1.6" fill={OB.gold} /> : null}
        {m.booths.map((b, i) => (
          <rect key={`b${i}`} x={b.x - 2} y={b.y * 0.6 - 1.4} width="4" height="2.8" rx="0.4" fill={b.branded ? OB.gold : OB.soft} fillOpacity={b.branded ? 0.9 : 0.35} />
        ))}
        {m.tables.map((t, i) =>
          t.kind === 'long' || t.kind === 'rect' ? (
            <rect key={`t${i}`} x={t.x - 3} y={t.y * 0.6 - 1.2} width="6" height="2.4" rx="0.5" fill={OB.text} fillOpacity="0.85" />
          ) : (
            <circle key={`t${i}`} cx={t.x} cy={t.y * 0.6} r="2" fill={OB.text} fillOpacity="0.85" />
          ),
        )}
      </svg>
      {empty ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: OB.soft }}>
          Your room, once you place the first table
        </p>
      ) : null}
    </div>
  );
}

export function Plan3dStage({
  slug,
  standing,
  facts,
  lede,
  miniature,
  tableCount,
  editHref,
  walkHref,
  publicHref,
}: {
  slug: string | null;
  standing: Plan3dStanding;
  facts: readonly HubFact[];
  /** One sentence for the state, already resolved. */
  lede: { strong: string; rest: string };
  miniature: StageMiniature | null;
  tableCount: number | null;
  editHref: string;
  walkHref: string;
  /** `/[slug]/venue` when the room is live and the slug is known, else null. */
  publicHref: string | null;
}) {
  const pill =
    !standing.measured ? { text: 'Unread', dot: OB.soft } :
    standing.state === 'draft' ? { text: 'Draft', dot: OB.soft } :
    standing.state === 'after' ? { text: 'Live · after the day', dot: OB.gold } :
    { text: 'Live', dot: '#7BC47F' };
  return (
    <section aria-labelledby="plan3d-stage-address" className="mt-6 overflow-hidden rounded-2xl" style={{ backgroundColor: OB.page }}>
      <div className="grid gap-5 p-5 sm:grid-cols-[3fr_2fr] sm:p-6">
        <div>
          <Miniature m={miniature} measured={standing.measured} />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: OB.soft }}>
            {tableCount == null ? '— tables' : `${tableCount} table${tableCount === 1 ? '' : 's'}`} · drawn from your seat plan
          </p>
        </div>
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: OB.gold }}>
            As your guests see it · right now
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: OB.card, color: OB.text }}>
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
            {pill.text}
          </p>
          <h2 id="plan3d-stage-address" className="text-lg font-semibold tracking-tight sm:text-xl" style={{ color: OB.text }}>
            {slug ? `setnayan.com/${slug}/venue` : 'Your room’s address, once your link is set'}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: OB.soft }}>
            <strong style={{ color: OB.text }}>{lede.strong}</strong> {lede.rest}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {publicHref ? (
              <Link href={publicHref} className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold" style={{ backgroundColor: OB.cta, color: OB.page }}>
                <Eye aria-hidden className="h-4 w-4" strokeWidth={2} /> Open as a guest
              </Link>
            ) : (
              <Link href={walkHref} className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold" style={{ backgroundColor: OB.cta, color: OB.page }}>
                <Eye aria-hidden className="h-4 w-4" strokeWidth={2} /> Walk it yourself
              </Link>
            )}
            <Link href={editHref} className="inline-flex h-10 items-center gap-1.5 rounded-md border px-4 text-sm font-semibold" style={{ borderColor: OB.hairline, color: OB.text }}>
              <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} /> Edit the room
            </Link>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ backgroundColor: OB.hairline }}>
        {facts.map((f) => (
          <div key={f.label} className="px-5 py-3" style={{ backgroundColor: OB.page }}>
            <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: OB.gold }}>{f.label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums" style={{ color: f.known ? OB.text : OB.soft }}>
              {f.known && f.value != null ? f.value : '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
