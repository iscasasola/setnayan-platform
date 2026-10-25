## 2026-10-25 · fix(ui): one ⓘ — every info dot wears InfoTip's grey-ink look

Owner, on the Suppliers page's "Cover your event" header (an orange "i" on a white disc beside pages whose ⓘ is grey):
*"and the (i) is not consistent across the app"*.

- **Seven different ⓘ drawings found** on `origin/main`: `<InfoTip>` (16 px, ink/25 hairline, 10-px semibold ink/55
  "i" — 77 files), `<Explain>` (22-px white disc, bold ACCENT "i" — the Suppliers page, every Form row and Page card,
  the Maker's stage panel, the mood board, the guest card), the My Events shelf `<details>` (20 px, bold italic),
  the setup card (28 px, 12-px "i"), the day rail's `Tip` (InfoTip minus its ring/transition), the selfie step's and
  the Maker who×when stage's (a lucide `Info` glyph), and the wallet notice page (the font's own `ⓘ`).
- **The rule is InfoTip's look** — the most used, the calm one, and it presses at 46 px through `.sn-dot-btn`'s halo.
  Grey ink at rest; `terracotta` while hovered or open (on a guest page, the couple's own colour). InfoTip itself is
  unchanged. The one difference: `<Explain>` turns `sn-accent` when open, because a template file may name no colour
  (`the-form-row.test.ts` (10)) and it only draws on the app's own pages. The obsidian stage uses its literal
  equivalents (ink tokens read 1.27:1 there). No tip's words changed; no behaviour changed (Explain still opens its
  centred popup on a phone, the shelf still works without JavaScript).
- **Guard:** `app/_components/there-is-one-info-dot.test.ts` reads the look from `info-tip.tsx` and fails on any
  hand-drawn "i" outside a reasoned list, any listed one that is off the look (size, hairline, weight, resting
  colour, open colour, 44-px press), the `ⓘ` glyph rendered as text, and an icon-only button whose face is a lucide
  info glyph. Run against `origin/main`'s files it names the Suppliers ⓘ, the wallet glyph and both lucide ones.

SPEC IMPACT: The approved control-templates gallery (`prototypes/control_templates_2026-10-08.html` § 7, kind 7
"ⓘ Explanation") drew the mark in the accent; this supersedes that one detail (the mark is InfoTip's grey ink, the
accent only when open). Needs a DECISION_LOG row once the owner approves the draft.
