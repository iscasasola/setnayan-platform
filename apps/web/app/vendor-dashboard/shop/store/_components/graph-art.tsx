/**
 * 📈 A graph's small picture (Store drawing v12) — a plain bar sketch in the link blue: the Store and the Shop's Edit
 * sheet show WHAT a graph is, never numbers. No hooks and no reads, so server and client screens both draw it.
 */
export function GraphArt({ size = 40, wide = false }: { size?: number; wide?: boolean }) {
  const w = wide ? size * 3 : size;
  const bars = wide ? [0.35, 0.55, 0.45, 0.7, 0.6, 0.85, 0.5, 0.75, 0.95, 0.65, 0.8, 0.9] : [0.4, 0.65, 0.5, 0.9];
  const gap = w / (bars.length * 3);
  const bw = (w - gap * (bars.length + 1)) / bars.length;
  return (
    <svg aria-hidden width={wide ? '100%' : w} height={size} viewBox={`0 0 ${w} ${size}`} preserveAspectRatio={wide ? 'none' : undefined} className="block text-[rgb(var(--color-link))]">
      <rect width={w} height={size} rx={8} className="fill-[color:var(--surface-soft)]" />
      {bars.map((h, i) => (
        <rect key={i} x={gap + i * (bw + gap)} y={size - 6 - (size - 12) * h} width={bw} height={(size - 12) * h} rx={2} fill="currentColor" opacity={0.85} />
      ))}
    </svg>
  );
}

