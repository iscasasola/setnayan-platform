/**
 * 📱 THE STRIP'S NOTES FLOAT ON A PHONE — an open `(i)` note inside the Maker's
 * scene strip is placed against the VIEWPORT, never inside the strip.
 *
 * WHY. On a phone the strip cannot scroll on Y (`MAKER_STRIP_PHONE`), so a note
 * hanging inside it is clipped. MEASURED at 375 px with the Maker in Desktop
 * view: a tile label had 81 px above it and 35 px below it in a 116 px strip,
 * and the longest real note (a fixed scene's "where it comes from") is 132 px —
 * it fits neither way.
 *
 * WHY HERE, NOT IN `<InfoTip>`. InfoTip ships on every page, the home page
 * included, whose first-load JS must not grow; this lives with the Maker (its
 * only caller is the navigator, `editor-shell.tsx`). It watches the strip's
 * `.sn-tip` nodes for `data-open` and places an open one; a scroll anywhere
 * re-places it beside its `(i)`; a closed one gets its own placement back.
 */

/** Where a floating note goes: below its trigger when it fits, else above; always inside the viewport. */
export function tipPlacement(
  trigger: { top: number; bottom: number; left: number },
  tipHeight: number,
  viewport: { width: number; height: number },
): { top: number; left: number; width: number } {
  const M = 8;
  const width = Math.min(288, viewport.width - 32);
  const left = Math.max(16, Math.min(trigger.left - 4, viewport.width - width - 16));
  const below = trigger.bottom + 6;
  const above = trigger.top - 6 - tipHeight;
  const top =
    below + tipHeight <= viewport.height - M
      ? below
      : above >= M
        ? above
        : Math.max(M, Math.min(below, viewport.height - M - tipHeight));
  return { top, left, width };
}

/** Below this width the Maker is a phone and the strip's notes float. */
export const FLOAT_TIPS_BELOW_PX = 1024;

const PLACED = ['position', 'top', 'left', 'right', 'bottom', 'width', 'max-width', 'translate', 'padding-top'];

/** Float every open `.sn-tip` under `root` on a phone; returns the teardown. */
export function floatOpenTips(root: HTMLElement, win: Window): () => void {
  const clear = (tip: HTMLElement) => {
    for (const p of PLACED) tip.style.removeProperty(p);
  };
  const place = (tip: HTMLElement) => {
    const trigger = tip.parentElement?.querySelector('button');
    if (!trigger || win.innerWidth >= FLOAT_TIPS_BELOW_PX) {
      clear(tip);
      return;
    }
    const vw = win.innerWidth;
    tip.style.position = 'fixed';
    tip.style.right = 'auto';
    tip.style.bottom = 'auto';
    tip.style.translate = 'none';
    tip.style.paddingTop = '0px';
    tip.style.maxWidth = 'none';
    tip.style.width = `${Math.min(288, vw - 32)}px`;
    const at = tipPlacement(trigger.getBoundingClientRect(), tip.offsetHeight, { width: vw, height: win.innerHeight });
    tip.style.top = `${at.top}px`;
    tip.style.left = `${at.left}px`;
  };
  const sync = (tip: HTMLElement) => (tip.dataset.open === 'true' ? place(tip) : clear(tip));
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      const t = r.target as HTMLElement;
      if (t.classList?.contains('sn-tip')) sync(t);
    }
  });
  mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-open'] });
  const replace = () => root.querySelectorAll<HTMLElement>('.sn-tip[data-open="true"]').forEach(place);
  win.addEventListener('scroll', replace, true);
  win.addEventListener('resize', replace);
  return () => {
    mo.disconnect();
    win.removeEventListener('scroll', replace, true);
    win.removeEventListener('resize', replace);
    root.querySelectorAll<HTMLElement>('.sn-tip').forEach(clear);
  };
}
