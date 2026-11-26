/**
 * 🖼 THE PLAN POSTER — one plan drawn with no tools: the wall, its doors and its tables, the room's name and size in the
 * corner. Moved out of the retired PlanMaker (seat plan PR2, option B: the couple's editor is the one engine) so the
 * couple's 3D room can still draw it at once instead of a blank screen (owner 2026-11-20, "never a blank screen").
 */
import {
  CHAIR_PX,
  doorPoint,
  planAspect,
  planFootprintM,
  planRoomM,
  planRoomWords,
  planTableGeometry,
  planTablePositions,
  type Plan,
  type TableGeometry,
} from '@/lib/seat-plan-engine';

const W = 1000;

/** One table, drawn at its own size, centred on 0,0 in geometry px. */
export function TableShapeSvg({
  g,
  label,
  seated,
  names,
  marked,
  selected,
  fontPx,
}: {
  g: TableGeometry;
  label: string;
  seated: number;
  names: readonly string[] | null;
  marked: boolean;
  selected: boolean;
  fontPx: number;
}) {
  const line = selected ? 'stroke-terracotta-700' : 'stroke-ink';
  const chairR = CHAIR_PX * 0.36;
  return (
    <g>
      {g.outline ? (
        <path
          d={`${g.outline.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}Z`}
          className={`fill-ink/10 ${line}`}
          strokeWidth={selected ? 4 : 2}
        />
      ) : null}
      {g.hub.shape === 'round' ? (
        <circle r={g.hub.radius} className={`fill-cream ${line}`} strokeWidth={selected ? 4 : 2} />
      ) : g.hub.shape !== 'ribbon' ? (
        <rect
          x={-g.hub.w / 2}
          y={-g.hub.h / 2}
          width={g.hub.w}
          height={g.hub.h}
          rx={g.hub.shape === 'pill' ? g.hub.h / 2 : Math.min(12, g.hub.radius)}
          className={`fill-cream ${line}`}
          strokeWidth={selected ? 4 : 2}
        />
      ) : null}
      {g.seats.map((s, k) => {
        const who = names?.[k] ?? null;
        const filled = names ? Boolean(who) : k < seated;
        return (
          <g key={k} transform={`translate(${s.x} ${s.y})`} data-plan-seat={k}>
            <circle r={chairR} className={filled ? 'fill-ink stroke-ink' : 'fill-raised stroke-ink'} strokeWidth={2} />
            {who ? (
              <text textAnchor="middle" dominantBaseline="central" fontSize={chairR} className="fill-cream" fontWeight={700}>
                {who.trim().charAt(0).toUpperCase()}
              </text>
            ) : null}
          </g>
        );
      })}
      <text textAnchor="middle" dominantBaseline="central" fontSize={fontPx} className="fill-ink" fontWeight={600}>
        {label.length > 10 ? `${label.slice(0, 9)}…` : label}
      </text>
      {marked ? <circle r={Math.max(g.box.w, g.box.h) / 2 + 6} fill="none" className="stroke-terracotta-700" strokeWidth={8} data-plan-marked="" /> : null}
    </g>
  );
}

/**
 * 🖼 THE FLOOR AS A POSTER — the plan's own drawing (the same wall, doors and tables as the Floor plan view above) with
 * no tools and no chrome, its name and size in the corner. Shown while something heavier loads over it: the couple's
 * 3D room draws it at once instead of a blank screen (owner 2026-11-20, "never a blank screen").
 */
export function PlanPoster({
  plan,
  roomName,
  className = '',
  seated,
}: {
  plan: Plan;
  roomName?: string | null;
  className?: string;
  /** Seated guests per table id — that many chairs drawn filled, as the couple's own plan draws them. Counts only,
   *  never names (A7-16: the supplier's read-only seat plan). Absent → every chair drawn empty. */
  seated?: Readonly<Record<string, number>>;
}) {
  const room = planRoomM(plan.room);
  const H = W / planAspect(plan.room);
  const pxPerM = W / room.widthM;
  const positions = planTablePositions(plan.tables);
  const words = planRoomWords(plan.room, roomName);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block ${className}`} role="img" aria-label={`Floor plan, ${words.size}, ${plan.tables.length} tables`} data-plan-poster="">
      <rect x={4} y={4} width={W - 8} height={H - 8} fill="none" className="stroke-current" strokeWidth={8} />
      <text x={28} y={54} fontSize={30} fontWeight={700} className="fill-current">{words.name}</text>
      <text x={28} y={90} fontSize={26} className="fill-current" opacity={0.7}>{words.size}</text>
      {plan.doors.map((d) => {
        const p = doorPoint(d);
        const along = d.wall === 'top' || d.wall === 'bottom';
        const len = Math.max(60, 1.4 * pxPerM);
        const cx = (p.x / 100) * W;
        const cy = (p.y / 100) * H;
        return (
          <line key={d.id} x1={along ? cx - len / 2 : cx} x2={along ? cx + len / 2 : cx} y1={along ? cy : cy - len / 2} y2={along ? cy : cy + len / 2} className="stroke-terracotta-700" strokeWidth={22} strokeLinecap="round" />
        );
      })}
      {plan.tables.map((t, i) => {
        const g = planTableGeometry(t);
        const p = positions[i]!;
        const s = (planFootprintM(t) * pxPerM) / g.box.w;
        return (
          <g key={t.id} transform={`translate(${(p.x / 100) * W} ${(p.y / 100) * H}) scale(${s}) rotate(${t.rotationDeg ?? 0})`} data-plan-table={t.id}>
            <TableShapeSvg g={g} label={t.label} seated={seated?.[t.id] ?? 0} names={null} marked={false} selected={false} fontPx={Math.max(18, 24 / s)} />
          </g>
        );
      })}
    </svg>
  );
}
