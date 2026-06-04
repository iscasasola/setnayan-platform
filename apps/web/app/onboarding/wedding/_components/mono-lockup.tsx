/* ── MonoLockup — live-typography wedding monogram (owner 2026-06-04) ─────────
   Five curated designs, each driven by the couple's real initials + first names
   so the mark stays razor-crisp at any size (no image generation, except the
   ornate gold frame on design 4). "Generate another design" in onboarding-shell
   cycles MONO_DESIGNS; the CSS renders each style by its .lk-* class.

   Owner's rules (the 5 designs):
     1 bar      — two serif capitals flanking a vertical line w/ "&", first names below
     2 script   — three calligraphy glyphs: initial · & · initial, flowing/interlocked
     3 duo      — two serif capitals, no line, pulled close / slightly overlapping
     4 framed   — initials inside an ornate gold frame
     5 infinity — two capitals joined by an ∞ ribbon that links them            */

export type MonoStyle = 'bar' | 'script' | 'duo' | 'framed' | 'infinity';
export type MonoDesign = { style: MonoStyle; font: string; frame?: string };

type Props = {
  design: MonoDesign;
  /** Bride initial (already upper-cased, may be '') */
  bi: string;
  /** Groom initial (already upper-cased, may be '') */
  gi: string;
  brideName: string;
  groomName: string;
  /** brief scale-pop on cycle */
  pop?: boolean;
};

export function MonoLockup({ design, bi, gi, brideName, groomName, pop }: Props) {
  const a = bi || '·';
  const b = gi || '·';
  const names = [brideName.trim(), groomName.trim()].filter(Boolean).join(' & ');
  const popStyle = pop ? { transform: 'scale(1.05)' } : undefined;
  const label = names || `${bi}${gi}` || 'Your monogram';

  const Names = names ? <div className="lk-names">{names}</div> : null;

  if (design.style === 'bar') {
    return (
      <div className="mono-lk lk-bar" style={popStyle} role="img" aria-label={label}>
        <div className="lk-row">
          <span className="lk-cap">{a}</span>
          <span className="lk-div">
            <span className="lk-amp">&amp;</span>
          </span>
          <span className="lk-cap">{b}</span>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'script') {
    return (
      <div className="mono-lk lk-script" style={popStyle} role="img" aria-label={label}>
        <div className="lk-srow">
          <span className="lk-scap">{a}</span>
          <span className="lk-samp">&amp;</span>
          <span className="lk-scap">{b}</span>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'duo') {
    return (
      <div className="mono-lk lk-duo" style={popStyle} role="img" aria-label={label}>
        <div className="lk-drow">
          <span className="lk-cap">{a}</span>
          <span className="lk-cap lk-cap2">{b}</span>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'framed') {
    return (
      <div className="mono-lk lk-framed" style={popStyle} role="img" aria-label={label}>
        <div className="lk-frame" data-frame={design.frame ?? 'wreath'}>
          <span className="lk-fcaps">
            {bi}
            {gi}
          </span>
        </div>
        {Names}
      </div>
    );
  }

  // infinity — two caps sitting in the loops of a gold ∞ that links them
  return (
    <div className="mono-lk lk-inf" style={popStyle} role="img" aria-label={label}>
      <div className="lk-infwrap">
        <svg className="lk-infsvg" viewBox="0 0 200 92" aria-hidden="true" focusable="false">
          {/* pathLength=1 normalizes the stroke for the Trace draw-on (free effect) */}
          <path pathLength={1} d="M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z" />
        </svg>
        <span className="lk-cap lk-icap lk-icap-l">{a}</span>
        <span className="lk-cap lk-icap lk-icap-r">{b}</span>
      </div>
      {Names}
    </div>
  );
}
