/**
 * lib/maker-stage-type.ts — import-free, so the Maker's first-load work area
 * (`editor-shell.tsx`) can ask it without pulling the parts map
 * (`lib/maker-parts.ts`) into the first load (`scripts/check-maker-js-budget.mjs`).
 */
/**
 * ⌨ TYPING IS A SECOND TAP (DECISION_LOG 2026-10-07 rule 1; the prototype's `page`
 * click: `if(id===S.sel&&ELS[id].text) startTyping`). A tap on a part's words FIRST
 * picks the part — the panel opens on it; only a tap on the words of the part that
 * is ALREADY picked types. The date and the place are never typed (they are
 * Suppliers'). `picked` is the shell's `data-stage-picked` — `<canvas>|<el>` of the
 * picked part (`stage-tools.tsx`); `key` / `el` are the canvas's type-start.
 */
export function makerStageMayType(picked: string | null | undefined, key: string, el: string | null | undefined): boolean {
  if (key === 'f:hero' && (el === 'date' || el === 'venue')) return false;
  if (!picked) return false;
  const [pk, pe] = picked.split('|') as [string, string | undefined];
  if (pk !== key) return false;
  return !pe || pe === (el ?? '');
}
