## 2026-10-08 · feat(design): `.sn-glass-row` — every floating row is glass (Rule 7)

Owner 2026-10-07 on the Guests thumb row: "the row with search add and buttons needs to blur the background with its color. not a opaque. must blur the content behind" → "apply this to all glass row".

- One shared recipe, `.sn-glass-row` in `apps/web/app/globals.css` (`@layer components`, beside `.sn-glass-bare`): translucent paper (`--color-cream` at `--sn-glass-row-alpha` 62 %) over `--sn-glass-row-blur` (`blur(16px) saturate(1.3)`, with the -webkit- prefix), the existing `--sn-glass-line` edge, NO shadow, blur clipped to the row (`overflow:hidden; isolation:isolate; -webkit-mask-image`). Light + `html.dark` tokens. Toned buttons inside keep their full colour.
- Applied (class swap; opaque fills, shadows and per-row blur dropped) to the six floating rows on `origin/main`: the Mood Board PDF bar, the Panood control-room section tabs, the Budget "Save plan" bar, the half-sheet slim bar, the pay page's bottom bar, the generic onboarding Back/Continue bar.
- Guard `apps/web/lib/floating-rows-are-glass.test.ts`: the recipe keeps its backdrop-filter (+ -webkit-), its clip, no shadow, no gradient; every listed row (anchored by `data-glass-row`) wears the class and no overriding `bg-*`/`shadow-*`/`backdrop-blur*`/border colour. Sabotaged (shadow added · backdrop-filter removed · `bg-white/95` put back on the pay bar) — each went red.

SPEC IMPACT: None — implements BUTTON_RULE_2026-10-07_fable.md § Rule 7 as written.
