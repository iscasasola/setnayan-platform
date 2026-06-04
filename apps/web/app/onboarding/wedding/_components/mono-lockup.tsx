/* ── MonoLockup — live-typography wedding monogram (owner 2026-06-04) ─────────
   Five curated designs driven by the couple's real initials + first names, and
   — owner-locked 2026-06-04 — every design animates with the "Trace" effect: the
   letters DRAW THEMSELVES (outline strokes on like a pen, then fills), the ∞ and
   the bar's divider draw as lines, the filigree ring settles in. Letters are SVG
   <text> so the outline can be stroke-drawn; the final filled look is identical
   to plain text. All motion is gated on prefers-reduced-motion in onboarding.css.

   Owner's five lockups:
     bar      — two serif capitals flanking a vertical line carrying "&", names below
     script   — three calligraphy glyphs: initial · & · initial
     duo      — two serif capitals, no line, pulled close / overlapping
     framed   — both initials inside an ornate gold filigree frame
     infinity — two capitals joined by a gold ∞ that links them                  */

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
  const popStyle = pop ? { transform: 'scale(1.04)' } : undefined;
  const label = names || `${bi}${gi}` || 'Your monogram';
  const Names = names ? <div className="mt-names">{names}</div> : null;

  if (design.style === 'bar') {
    return (
      <div className="mono-lk mt mt-bar" style={popStyle} role="img" aria-label={label}>
        <div className="mt-row">
          <svg className="mt-g mt-cap" viewBox="0 0 60 96" aria-hidden="true">
            <text className="mt-gt mt-corm" x="30" y="74" textAnchor="middle">{a}</text>
          </svg>
          <svg className="mt-g mt-line mt-d2" viewBox="0 0 30 96" aria-hidden="true">
            <line x1="15" y1="14" x2="15" y2="82" />
            <text className="mt-gt mt-amp" x="15" y="57" textAnchor="middle">&amp;</text>
          </svg>
          <svg className="mt-g mt-cap mt-d3" viewBox="0 0 60 96" aria-hidden="true">
            <text className="mt-gt mt-corm" x="30" y="74" textAnchor="middle">{b}</text>
          </svg>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'duo') {
    return (
      <div className="mono-lk mt mt-duo" style={popStyle} role="img" aria-label={label}>
        <div className="mt-row mt-tight">
          <svg className="mt-g mt-cap" viewBox="0 0 60 96" aria-hidden="true">
            <text className="mt-gt mt-play" x="34" y="74" textAnchor="middle">{a}</text>
          </svg>
          <svg className="mt-g mt-cap mt-cap2 mt-d2" viewBox="0 0 60 96" aria-hidden="true">
            <text className="mt-gt mt-play" x="26" y="74" textAnchor="middle">{b}</text>
          </svg>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'script') {
    return (
      <div className="mono-lk mt mt-script" style={popStyle} role="img" aria-label={label}>
        <div className="mt-srow">
          <svg className="mt-g mt-scriptsvg" viewBox="0 0 200 120" aria-hidden="true">
            <text className="mt-gt mt-scr" x="40" y="84" textAnchor="middle">{a}</text>
            <text className="mt-gt mt-scr mt-samp mt-d2" x="100" y="84" textAnchor="middle">&amp;</text>
            <text className="mt-gt mt-scr mt-d3" x="160" y="84" textAnchor="middle">{b}</text>
          </svg>
        </div>
        {Names}
      </div>
    );
  }

  if (design.style === 'framed') {
    return (
      <div className="mono-lk mt mt-framed" style={popStyle} role="img" aria-label={label}>
        <div className="mt-frame" data-frame={design.frame ?? 'filigree'}>
          <svg className="mt-g mt-fcaps" viewBox="0 0 92 60" aria-hidden="true">
            <text className="mt-gt mt-cin mt-fc" x="30" y="44" textAnchor="middle">{a}</text>
            <text className="mt-gt mt-cin mt-fc mt-fc2" x="62" y="44" textAnchor="middle">{b}</text>
          </svg>
        </div>
        {Names}
      </div>
    );
  }

  // infinity — two caps in the loops of a gold ∞ that draws itself, then links them
  return (
    <div className="mono-lk mt mt-inf" style={popStyle} role="img" aria-label={label}>
      <div className="mt-infwrap">
        <svg className="mt-infsvg" viewBox="0 0 200 92" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="mt-gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#A88340" />
              <stop offset="0.5" stopColor="#E4C77E" />
              <stop offset="1" stopColor="#A88340" />
            </linearGradient>
          </defs>
          <path
            pathLength={1}
            d="M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z"
          />
        </svg>
        <svg className="mt-g mt-ic mt-ic-l" viewBox="0 0 60 60" aria-hidden="true">
          <text className="mt-gt mt-corm" x="30" y="46" textAnchor="middle">{a}</text>
        </svg>
        <svg className="mt-g mt-ic mt-ic-r mt-d2" viewBox="0 0 60 60" aria-hidden="true">
          <text className="mt-gt mt-corm" x="30" y="46" textAnchor="middle">{b}</text>
        </svg>
      </div>
      {Names}
    </div>
  );
}
