# Design token map — Phase 1 inventory (14 Nov 2026)

> **Status: names approved (owner, 14 Nov: "keep house names"). Phase 2 tokens are in `globals.css`.**
> The other three calls in §1 took the no-change option: both button heights are tokens as they are, only
> the exact radius match is aliased, and nothing is renamed.
>
> **What Phase 2 changed from the proposal below:**
> - `--sn-border` was dropped, because `--sn-line` already is that role.
> - The colour keys `sn.surface-soft` / `sn.muted` / `sn.line` were not added to Tailwind.
>   `lib/the-accent-is-one-token.test.ts` keeps the `sn` colour family to the accent alone.
> - Button colour tokens (`--sn-btn-primary-bg` …) are **use-site hooks with today's expression as the
>   fallback, declared nowhere.** Their sources (`--sn-decision`, `--color-mulberry`, `--color-ink`,
>   `--color-cream`) are re-pointed per scope by hub themes, `[data-art]` and Admin › Colours. A `:root`
>   alias would resolve once at the root and freeze those scopes.
>
> The original proposal follows.
> Measured on `origin/main` @ `0e9f11ab51` (14 Nov 2026, 21:18). It scanned 11,510 files under
> `apps/web/{app,components,lib}`, with comments removed by `lib/strip-comments.ts`. Scanner:
> `docs/design-token-map.scan.mts` (run: `tsx docs/design-token-map.scan.mts apps/web out.json`).
> **Never trust a count here as current. Run the scan again.**

---

## 0 · Rule 0: what already exists

Five sources were checked before anything was proposed:

- `apps/web/app/globals.css` (10,990 lines);
- `apps/web/tailwind.config.ts`;
- `build-sessions/DESIGN-FOUNDATION.md`;
- the corpus `Design_App_Colours_2026-11-12/map/` (local only, not yet committed in the specs repo);
- `DECISION_LOG.md` (origin/main), rows dated 2026-10-26, 2026-11-04 and 2026-11-14.

| | |
|---|---|
| **Exists** | **The token system exists, but it is split across five families.** `--color-*` (RGB triplets that Tailwind reads, 183 definitions). `--m-*` (the Atelier kit: hex palette, radius `--m-r-*` and shadow `--m-shadow-*`, 104). `--sn-*` (house roles, motion, z-index, frame and band, plus a second radius scale `--sn-r-*`, 170). `--ramp-*` (status ramps, 20). Legacy `--accent` / `--surface`. Dark mode exists (`html.dark` pairs). Tailwind already exposes radius, shadow, z-index, motion and colours, and `lint:radius` already bans `rounded-[Npx]`. **The button already exists:** `components/action-button.tsx`, 1,104 uses, 6 tones, a 40 px pill. **The frame classes already exist:** `.sn-tile` (365 uses), `.sn-row` (129), `.sn-card` (6). **Admin › Colours wave 1 is merged** (#7537): `--sn-page-bg`, `--sn-band-*`, `--sn-frame-*` and the runtime `--sn-decision` (set from `platform_settings` and deliberately *not* declared in CSS: `lib/a-dark-look-keeps-its-words.test.ts:369`). **The template-score ratchet is merged** (#7704). It already fails a page whose raw-hex count rises. |
| **Missing** | **(a)** Nothing joins the families. `--m-paper` is white, and so are `--color-cream`, `--surface`, `--sn-surface`, `--sn-page-bg` and `--sn-frame-bg`: six names for one value. **(b)** `.sn-tile` and `.sn-row` do not read `--sn-frame-*` yet; that was wave 2 of the 12 Nov plan. **(c)** No type scale: 7,738 `text-[Npx]` uses across 132 values. **(d)** No button-size or button-colour component tokens: `ActionButton`, `.button-primary` and `.button-secondary` each hard-code their own values. **(e)** No app-wide guard for raw hex. The ratchet is per page and does not see `components/` or `lib/`. **(f)** No `/dev/tokens` swatch page. |
| **Delta (this task)** | Adopt the existing families as the three tiers and add only the missing role and component names. Wire `.sn-tile`, `.sn-row`, `.sn-card`, `ActionButton`, `.button-*` and `Sheet` to them with values unchanged. Collapse only exact duplicates now, and leave near-duplicates for the restyle task. Add an app-wide hex guard that shrinks, plus a `/dev/tokens` page. |

### ⚠ This overlaps live work. Read before approving Phase 2 and 3

| In flight | What it touches | Consequence for this task |
|---|---|---|
| **Admin › Colours plan** (12 Nov, waves 2–6) | Frame tokens into `.sn-tile` / `.sn-row` / `.sn-card` (wave 2), money tone (3), header band (4), strays (5) | Phase 2 frame tokens **are** wave 2. Use its names (`--sn-frame-*`); do not invent `--card-*`. |
| **Template wave PRs, open now**: #7683 · #7687 · #7691 · #7706 · #7709 · #7710 · #7711 · #7715 · #7718 · #7721 · #7728 | The same page files Phase 3 would migrate (couple, admin and public areas) | Phase 3 batches would conflict with these. Migrate only areas no open PR touches, or ride inside those PRs. |
| **Template sheet, 14 Nov** (owner-approved, 15 rules) | Rule 14: spacing **4·8·12·16·24** and **three corner sizes**. Rule 3: pill buttons with ONE terracotta main | Token *names* below follow these targets. Collapsing to them changes pixels, so it is the restyle task, not this one. |

---

## 1 · Decisions needed from you before Phase 2

1. **Token names: keep the house prefix or use the generic names in the brief?** The brief's
   `--surface-page`, `--surface-card`, `--accent` and `--btn-*` **collide with tokens that already
   exist and mean something else**:
   - `--accent` is the legacy **gold** `#c5a059` (Tailwind `accent-deep` / `accent-soft`);
   - `--surface` is white, used by `bg-surface` (19+ files);
   - `--ab-*` are `ActionButton`'s private variables (12).

   **Recommended:** keep the `--sn-` prefix for roles and components (it is already the role tier, and Admin › Colours writes it). Leave `--m-*` and `--color-*` as the primitives. The table in §3 maps each name from the brief to the real one.
2. **The button height question is still open (44 vs 40).** It is the sheet's open call. Today the global floor is 44 px (`globals.css:406`, every `<button>`), `.button-primary` and `.button-secondary` are `h-11` (44), and `ActionButton` is 40. Recommended: tokenise both exactly as they are (`--sn-btn-min-height: 44px` and `--sn-btn-height: 40px`) and leave your call open.
3. **Two radius scales.** `--m-r-*` = 4 · 8 · 14 · 22 · 36 · 999. `--sn-r-*` = 6 · 10 · 14 · 18 · 999. Then `rounded-tile` 20 and `rounded-card` 18. Sheet rule 14 says three sizes. Recommended now: alias `--sn-r-lg` to `--m-r-md` (both 14), which changes nothing. Leave 6, 10, 18, 20, 22 and 36 as listed debt for the restyle.
4. **Ask-before-rename list.** These named tokens appear in corpus docs, and I will not rename any without your word: `--color-mulberry` (the name is inverted: it is terracotta, the CTA) · `--color-terracotta` (it is gold) · `--color-cream` (it is white) · `--sn-accent` · `--sn-decision` · `--sn-page-bg` · `--sn-frame-*` · `--sn-band-*` · `--sn-cat-*` · `--m-*`. The plan *aliases* them and renames nothing.

---

## 2 · The scale of it (measured)

Use counts across app chrome, where chrome = couple + supplier + admin + public + shared. The Event Hub, tests, dev labs, print and email are left out (see §6).

| Value kind | Uses outside a token | Distinct values | Worst area |
|---|---|---|---|
| Raw hex in `.tsx`/`.ts`/`.css` (not a token definition) | 2,554 in chrome (+2,699 in `lib`, mostly colour-name data, §6) | 1,827 | public 964 · shared 801 |
| `rgb()/rgba()/hsl()` literals | 1,017 | 874 | public 363 · couple 346 |
| Tailwind arbitrary colour `bg-[#…]` / `text-[var(--…)]` | 1,488 | 312 | public 734 |
| Raw Tailwind palette class (`bg-amber-50`, `text-red-700`) | 663 (+130 lib) | 141 | admin 319 |
| `bg-white` / `text-white` / `bg-black` | 1,524 | 15 | couple 611 |
| Radius as a token class (`rounded-*` → `--m-r-*`) | ✅ 8,428 already tokenised | 48 | — |
| Radius outside a token (`rounded-[…]`, CSS px, inline) | ≈220 (most CSS uses already read `var(--m-r-*)`) | 179 | public |
| Arbitrary shadow `shadow-[…]` + CSS `box-shadow` literals | 593 | 391 | public 150 (CSS) · couple 93 |
| Arbitrary font size `text-[Npx]` | **7,738** | 132 | couple 3,028 |
| CSS `font-size: Npx` | 1,848 | 265 | public 704 |
| Arbitrary spacing/size `p-[…]`, `min-h-[…]`, `w-[…]` | 3,267 | 904 | couple 972 |
| Arbitrary border width `border-[1.5px]`, `border-t-[3px]` | 111 | 11 | couple 41 |
| Hand-made button class strings on `<button>`/`<Link>`/`<a>` | 1,147 | **757 looks** | couple 452 |
| Hand-made frame class strings (rounded + border/bg/shadow) | 5,398 | 3,357 | couple 1,950 · admin 1,217 |

Hex closeness to an existing token (CIE76 ΔE, chrome): **1,681 uses exactly equal a token** (safe to
swap now, no pixel change) · 1,528 within ΔE < 5 of one (near duplicates: merging = visible change) ·
2,044 off-palette (ΔE ≥ 5).

---

## 3 · Proposed tokens

Rules: **⓪ = exact value already exists, swap is pixel-identical.** **△ = near duplicate, merging is a
visible change → listed, NOT done in this task.** New names are marked **NEW**; everything else exists.

### 3a · Primitives: the only place hex lives

Keep the existing kit palette. Hex values live in `--m-*` (light and dark). `--color-*` keeps the RGB-triplet form Tailwind needs for `/alpha`, and each one is a mechanical copy of its `--m-*` partner.

| Token | Value (light / dark) | Current values it replaces | Where used today (count + 3 examples) | Role |
|---|---|---|---|---|
| `--m-paper` | `#FFFFFF` / `#232019` | ⓪ `#ffffff` `#fff`, `bg-white` | `#ffffff` 964 all-areas · `bg-white` 1,147 · `app/(shell)/about/page.tsx:208` · `app/(shell)/blog/page.tsx:73` · `app/(shell)/explore/_lib/marketplace-view.tsx:4380` | white paper |
| `--m-paper-2` | `#F4F2EC` / `#2B2821` | ⓪ `#f4f2ec` (= `--surface-soft`); △ 56 warm off-whites `#faf7f2`(78) `#fbf8f1`(13) `#f6f3ef` … | `app/3d_plan/demo/[token]/_components/plan3d-guest-view.tsx:30` · `app/_components/app-store/studio-card-demo.tsx:504` | soft warm surface |
| **NEW** `--m-paper-3` | `#FBFBFA` | ⓪ `#fbfbfa` (115) — today a token only as `--sn-paper` `#fbfaf7` (ΔE 1.1) | `app/(shell)/monogram/page.tsx:121` · `app/[slug]/_lib/icon-source.ts:36` | near-white canvas |
| `--m-ink` | `#2C2A29` / `#FBFAF7` | ⓪ `#2c2a29`(29); △ `#2a2925`(22) `#2f2d2a`(20) `#2a2622` | `app/_components/qr-card.tsx` · `app/_components/home/HomeOverlays.tsx:475` · `app/_components/home/home-reskin.css:826` | body ink |
| `--m-sidebar-fg` → alias **NEW** `--m-ink-deep` | `#1B1A17` | ⓪ `#1b1a17`(184), `text-[#1B1A17]`(70); △ `#1a1a1a` `#1d1714` … 19 values | `app/_components/home/home-reskin.css:2073` · `app/tour/budget/_components/tour-budget-planner.tsx` · `app/admin/connection-logs/connection-logs-client.tsx:254` | deepest ink |
| `--m-slate-2` | `#6E6A62` | ⓪ `#6e6a62`(35); △ `#6c675e`(13); arbitrary `text-[var(--m-slate-2)]` (116) | `app/(shell)/monogram/page.tsx:105` · `app/dashboard/[eventId]/_components/event-dashboard.tsx:2889` | muted text |
| `--m-slate-3` | `#8A857B` | △ `#8c8884`(34) — the undefined `--m-grey` fallback, ΔE 3.7 | `app/_components/home/alaala-editorial-overlay.tsx:97` · `…/panood-demo-overlay.tsx:266` · `…/papic-demo-overlay.tsx:70` | faint text |
| `--m-line` | `#E1DCD1` | ⓪ `#e1dcd1`; △ 19 hairlines `#e7e1d8` `#e2ded4` … | `app/_components/plan3d/scene-lighting.tsx:351` · `app/_components/home/plan3d-demo-overlay.tsx:203` | hairline |
| `--m-orange` (gold) | `#A9834B` | ⓪ `#a9834b`(85), `border-[#A9834B]`(29) | `app/admin/connection-logs/connection-logs-client.tsx:85` · `app/tour/budget/_components/tour-budget-planner.tsx:273` | gold |
| `--m-mulberry` (terracotta CTA) | `#C24E25` / `#E5794E` | ⓪ `#c24e25`(34) | `app/(shell)/for-coordinators/_for-coordinators.css:454` · `app/_components/file-upload.tsx` | CTA terracotta |
| `--color-ok` / `--color-danger` / `--color-warn` | `#2B744A` / `#B3261E` / `#965A00` | △ `#2e7d4f`(18) `#1f7a4d`(6); △ `#b42318`(26) | `app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx:260` · `app/admin/data-privacy/_components/control-actions.tsx:80` | status |
| **NEW** `--m-slate-cool` | `#6A6E76` | △ `#6a6e76`(22) — a cool grey, ΔE 10 from any token. ⚠ **May differ on purpose** (admin media screens). | `app/admin/background-videos/background-videos-manager.tsx:109` · `app/admin/reveal-studio/std-video-moderation.tsx:117` · `app/admin/website-media/page.tsx:108` | admin media grey: ask |

**Exact-duplicate primitives to alias, with no pixel change.** White is declared 6 times: `--m-paper`, `--color-cream`, `--surface`, `--sn-surface`, `--sn-page-bg` and `--sn-frame-bg`. `--accent` `#c5a059` equals `--color-terracotta-600`'s dark value. `--m-nav-active` is a copy of `--m-orange-2`. `--sn-line` equals `--m-line`. Each becomes `var(--m-…)`, light and dark checked pair by pair.
⚠ **`--sn-decision` stays undeclared.** A test locks that, so a saved theme is never frozen.

### 3b · Semantic: roles that point at primitives

| Name in brief | **Existing token = use this** | Points at | Count today | Note |
|---|---|---|---|---|
| `--surface-page` | `--sn-page-bg` | `--m-paper` | `body` + 25 wrappers | Admin › Colours "Page background" |
| `--surface-card` | `--sn-frame-bg` | `--m-paper` | 0 readers (wave 2) | Admin › Colours "Frame" |
| `--surface-raised` | `--color-raised` (`bg-raised`) | `--m-paper` / dark `#232019` | — | card over page in dark |
| **NEW** `--sn-surface-soft` | (today `--surface-soft`, `--m-paper-2`) | `--m-paper-2` | `bg-[var(--m-paper)]` 43 + palette greys | soft wash |
| `--border-subtle` | **NEW** `--sn-border` (= `--sn-line`, `--m-line`) | `--m-line` | `border-[var(--m-line)]` 71 · CSS `1px solid` 615 | hairline |
| `--text-primary` | `--color-ink` (`text-ink`) | `--m-ink` | — | |
| **NEW** `--sn-text-muted` | (today `text-ink/55–70`, `--m-slate-2`) | `--m-slate-2` | `text-ink/70` in 20+ button looks | ⚠ sheet rule 13 lists 45–60 % ink as below AA: a fix, later |
| `--accent` | `--sn-accent` (toggle on / picked) | `--color-mulberry` | — | **not** `--accent` (gold) |
| `--danger` / `--ok` / `--warn` / `--info` | `--color-danger` / `-ok` / `-warn` / `-info` | ramps | `tone=` 58 / 35 / 5 / 20 | |
| (decision) | `--sn-decision` (runtime, never declared) | falls back to `--color-mulberry` | `.button-primary`, `.ab-brand` | Admin › Colours "Decision" |

### 3c · Component: what the primitives and semantics feed

| Token | Reads | Current values it replaces | Where used (count + 3 examples) | Role |
|---|---|---|---|---|
| **NEW** `--sn-btn-min-height` | `44px` | the `min-height: 44px` base rule; `min-h-[44px]` (310) | `globals.css:406` · `app/(shell)/blog/page.tsx:346` · `app/(shell)/pricing/_pricing-pickers.tsx:118` | touch floor (kept, not removed) |
| **NEW** `--sn-btn-height` | `40px` | `ActionButton` height | 1,104 `<ActionButton>` · `components/action-button.tsx` | the pill |
| **NEW** `--sn-btn-height-lg` | `44px` | `.button-primary`/`.button-secondary` `h-11` | 243 + 172 uses · `app/(shell)/about/page.tsx` · `app/(shell)/explore/_components/filter-drawer.tsx` | the 44 rectangle (open call) |
| **NEW** `--sn-btn-radius` | `var(--m-r-full)` | ActionButton pill; `.app-surface .button-*` `--m-r-full` | as above | |
| **NEW** `--sn-btn-radius-rect` | `var(--m-r-sm)` | `.button-primary` `rounded-md` outside `.app-surface` | 243 | ⚠ inside `.app-surface` the same class is a pill; both states kept |
| **NEW** `--sn-btn-primary-bg` / `-fg` / `-bg-hover` | `--sn-decision` → `--color-mulberry` / `--sn-on-decision` / `--color-mulberry-600` | `bg-mulberry … text-cream` hand buttons (19 + 9 + 9 + 8 + 7 looks) | `app/admin/compliance/_components/compliance-form.tsx:406` · `app/_components/chat-amendment-card.tsx` · `app/_components/chat-thread-menu.tsx:228` | main verb |
| **NEW** `--sn-btn-secondary-bg` / `-fg` / `-border` | `--m-paper` / `--color-link` / `--color-link` 30 % | `.button-secondary` | 172 | |
| **NEW** `--sn-btn-ghost-bg` / `-fg` | `--color-ink` 5 % / `--color-ink` 70 % | `bg-ink/5 … text-ink/70 rounded-md` (20) | `app/_components/app-store/layout.tsx:150` · `app/dashboard/[eventId]/guests/quick/page.tsx:40` · `app/dashboard/[eventId]/hosts/page.tsx:135` | ghost |
| **NEW** `--sn-btn-danger-*` | `--color-danger` | ActionButton `tone="danger"` (58) | `app/_components/chat/chat-file-swipe.tsx` | destructive |
| **NEW** `--sn-btn-icon-size` | `44px` (round) | `h-11 rounded-full` icon buttons (9 + 5 + 5) | `app/_components/sheet.tsx:315` · `app/_components/gallery/gallery-lightbox.tsx:175` · `app/_components/get-directions.tsx:157` | icon button |
| `--sn-frame-bg` | `--m-paper` | `.sn-tile` `var(--m-paper)`, `.sn-row` `var(--m-paper)`, hand `bg-white border … rounded-*` | `.sn-tile` 365 · `.sn-row` 129 · `app/admin/approvals/page.tsx:185` | frame fill |
| **NEW** `--sn-frame-line` | `--m-line` | `.sn-tile`/`.sn-row` `1px solid var(--m-line)`; `border-ink/10`, `border-ink/15` | as above · `app/(shell)/help/page.tsx:140` | frame edge |
| `--sn-frame-radius` | `14px` (`--m-r-md`) | `.sn-tile` / `.sn-row` `var(--m-r-md)`; `rounded-lg` / `rounded-xl` (both 14 px) | 1,207 + 1,079 classes | frame corner |
| `--sn-frame-shadow` | `none` today; `.sn-tile` has `0 1px 3px rgba(30,26,18,.06)` | ⚠ **two values today**: tile has a hairline shadow, row none | `.sn-tile` 365 | keep two: **NEW** `--sn-frame-shadow-tile` |
| **NEW** `--sn-frame-padding` | `18px` | `.sn-tile` padding | 365 | |
| **NEW** `--sn-sheet-*` (bg, radius-top, shadow) | `--m-paper`, `--m-r-lg` (22 = `rounded-t-2xl`), `0 -30px 80px -40px rgba(26,26,26,.4)` | `Sheet`'s arbitrary shadows (8 + 4 + 4) | `app/_components/sheet.tsx:103` · `app/_components/anon-gate/save-to-continue.tsx:82` · `app/_components/requirements-modal.tsx:117` | the one floating surface |

### 3d · Radius, shadow, border, spacing and type

| Token | Value | Replaces | Count + examples | Note |
|---|---|---|---|---|
| `--m-r-sm` (`rounded`/`rounded-md`) | 8 | ⓪ `rounded-[var(--m-r-sm)]` (8) | 1,625 `rounded-md` · `app/_components/pinned-row/pin-door.tsx:29` | control corner. **Sheet "size 1"** |
| `--m-r-md` (`rounded-lg`/`xl`) | 14 | ⓪ `rounded-[var(--m-r-md)]` (23), `--sn-r-lg` 14 | `app/_components/proposal-maker.tsx:1841` · `app/dashboard/[eventId]/schedule/_components/block-swipe.tsx:28` | frame corner. **Sheet "size 2"** |
| `--m-r-full` | 999 | ⓪ `999px` / `9999px` in CSS (10 + 7) | 2,783 `rounded-full` · `app/globals.css:444` | pill. **Sheet "size 3"** |
| △ off-sheet corners | 4 · 6 · 10 · 18 · 20 · 22 · 36 | `rounded-sm` 98 · `--sn-r-sm/md/xl` · `rounded-card` 36 · `rounded-tile` 20 · `rounded-2xl` 836 · `rounded-3xl` 56 | `app/(shell)/about/page.tsx:320` | **visible change to collapse**: restyle task |
| `--sn-sh-*` / `--m-shadow-*` | existing | ⓪ `shadow-[var(--m-shadow-sm)]` (3) | `app/(shell)/alaala/page.tsx:321` | |
| **NEW** `--sn-sh-hair` | `0 1px 2px rgba(40,34,24,.06)` | `shadow-[0_1px_2px_rgba(40,34,24,.06)]` (8) | `app/dashboard/[eventId]/launch/_components/details-date-finder.tsx:108` · `…/details-guide.tsx:174` | |
| △ Tailwind `shadow` / `shadow-sm` / `-lg` / `-xl` / `-2xl` | Tailwind's own greys | 776 · 201 · 68 · 23 · 19 | `app/(shell)/explore/_components/vendor-card.tsx:362` | not on a token: map to `--m-shadow-sm/md/lg` = **visible change** |
| **NEW** `--sn-border-w` / `--sn-border-w-strong` / `--sn-border-w-edge` | 1px / 1.5px / 3px | CSS `1px` 615 · `border-[1.5px]` 35 · `border-t-[3px]`/`border-l-[3px]` 57 | `app/[slug]/_components/tick-box.tsx:28` · `app/_components/negotiation-card-shell.tsx:82` | 3 px = "needs action" edge (sheet rule 11) |
| **NEW** `--sn-space-1…5` | 4 · 8 · 12 · 16 · 24 (sheet rule 14) | Tailwind `p-1/2/3/4/6` already equal these | — | arbitrary `mt-[18px]` (28) etc. are △ |
| **NEW** `--sn-tap-md` / `--sn-tap-lg` / `--sn-tap-xl` | 48 / 52 / 56 | `min-h-[48px]` 63 · `min-h-[52px]` 66 · `min-h-[56px]` 24 | `app/(shell)/alaala/page.tsx:247` · `app/[slug]/_components/get-inside.tsx:103` | row heights |
| **NEW** `--sn-icon-sm` / `--sn-icon-md` | 18 / 22 | `w-[18px] h-[18px]` 182 · `w/h-[22px]` 26 | `app/(shell)/pricing/plan/_plan-quiz.tsx:235` · `app/_components/chat-send-form.tsx:561` | icon box |
| **NEW** type scale `--sn-fs-*` (Tailwind `text-sn-*`) | 9 · 10 · 11 · 12 · 13 · 14 · 15 · 17 · 19 · 22 | ⓪ `text-[10px]` 1,101 · `[11px]` 1,385 · `[12px]` 556 · `[13px]` 1,250 · `[14px]` 450 · `[15px]` 601 · `[17px]` 112 · `[9px]` 167 · `[19px]` 39 · `[22px]` 32 | `app/(shell)/blog/page.tsx:194` · `app/(shell)/explore/_components/explore-search-hero.tsx:47` · `app/(shell)/pricing/page.tsx:455` | exact steps: pixel-identical swap |
| △ half-pixel sizes | 12.5 · 13.5 · 11.5 · 10.5 · 14.5 · 9.5 · `0.7rem` · 7 · 8 | `text-[12.5px]` 508 · `[13.5px]` 223 · `[11.5px]` 146 · `[10.5px]` 114 · … | `app/[slug]/_components/dress-code-widget.tsx:822` | **visible change to collapse**: restyle task; 7–9 px may fail legibility |

---

## 4 · Near-duplicate clusters (ΔE < 3 around the most-used value)

| Cluster (uses) | Nearest token | Merge? |
|---|---|---|
| `#ffffff`(619) + 15 near-whites `#fbfaf7` `#fffdf8` `#fdfbf7` … | `--m-paper` | ⓪ white now; △ the rest later |
| `#1b1a17`(169) `#17160f`(20) `#1a1a1a`(15) + 16 | `--m-sidebar-fg` / `--sn-ink-black` | △ later |
| `#101010`(180) `#0e0f12` `#0f0f0f` `#111111` + 18 | none (ΔE 3.2 to `--color-paper`) | ⚠ mostly `lib/color-vocabulary.generated.ts` = colour names: **exception** |
| `#faf7f2`(30) `#fbf8f1`(13) + 54 warm off-whites | `--sn-canvas` `#f7f5f0` | △ later; one token `--m-paper-2` |
| `#f5efe6`(16) `#fbf6ea`(16) + 43 parchments | `--sn-keep-stock` `#f6f1e6` | △ later |
| `#5f5e5a`(69) `#5b5b5b`(13) | `--sp-ink2` `#5a5755` | △ (tour pages: **public demo**, see §6) |
| `#2e7d4f`(18) `#1f7a4d`(6) | `--color-ok` `#2b744a` ΔE 4.2 | △ |
| `#c9a14b`(12) `#cb9e4b`(9) | `--accent` ΔE 7.6 | ⚠ creator-teaser / reel renderer: may be print/video gold on purpose: ask |
| `#e7e1d8`(10) `#e2ded4`(9) + 17 | `--sp-line` `#e6e1d8` | △ |
| `#5c2542`(47) | none (ΔE 26) | ⚠ reveal overlay wine, **Event Hub**: exception |

## 5 · Button and frame looks

**Buttons.** There are 1,147 hand-made class strings in 757 distinct looks, against 1,104 `ActionButton` uses (tones: neutral 579 · brand 350 · danger 58 · ok 35 · info 20 · warn 5), plus `.button-primary` 243 and `.button-secondary` 172. These are the most repeated hand looks:

| Look (normalised class set) | Uses | → Variant | Examples |
|---|---|---|---|
| `bg-ink/5 font-medium px-3 py-1.5 rounded-md text-ink/70` | 20 | ghost · sm (8 px rect) | `app/_components/app-store/layout.tsx:150` · `app/dashboard/[eventId]/guests/quick/page.tsx:40` · `app/dashboard/[eventId]/hosts/page.tsx:135` |
| `bg-mulberry … rounded-md text-cream` (px-4 py-2 · px-3 py-1.5 · py-2.5) | 19 + 9 + 9 + 5 | primary · rect | `app/admin/compliance/_components/compliance-form.tsx:406` · `app/dashboard/[eventId]/studio/papic/_components/life-flash-card.tsx:89` |
| `bg-mulberry font-semibold px-4 py-2 rounded-full text-cream` | 8 | primary · pill | `app/_components/chat-thread-menu.tsx:228` · `app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx:1079` |
| `bg-mulberry font-medium h-9 px-3.5 rounded-lg text-cream` | 7 | primary · rect 36 px | `app/_components/amendment-builder.tsx:129` · `app/_components/chat-amendment-card.tsx:211` · `app/_components/chat-appointment-card.tsx:118` |
| `h-11 rounded-full` (± `text-ink`, `text-ink/55`) | 9 + 5 + 5 | icon | `app/_components/sheet.tsx:315` · `app/_components/chat/chat-step-card.tsx:70` |
| `bg-ink … rounded-xl text-cream` | 7 | ⚠ ink primary, public vendor doors | `app/vendor/fit/[ref]/page.tsx:234` · `app/vendor/lock/[token]/page.tsx:139` · `app/vendor-invite/[slug]/page.tsx:174` |
| `bg-[#1B1A17] min-h-[48px] px-7 py-3 rounded-full` | 6 | ⚠ tour demo pages: exception | `app/tour/page.tsx:55` |
| `bg-terracotta/5 border border-terracotta/30 … text-terracotta-700` | 6 | secondary · gold | `app/admin/integrity-watch/page.tsx:488` · `app/admin/repost-watch/page.tsx:427` |

There are five button primitives today: the base `button` floor, `ActionButton`, `.button-primary`, `.button-secondary` and `.ab`. **Phase 3 extends `ActionButton`.** It gets `variant`/`size` props that produce today's exact `.button-primary` and `.button-secondary` boxes, so moving a hand button onto it changes no pixel. Making them all a 40 px pill is the restyle.

**Frames.** There are 5,398 hand-made class strings in 3,357 looks. Many are **form fields, not frames**: `bg-white border border-ink/15 px-3 py-2 rounded-md`, 31 + 30 + 25. They belong to `lint:field-template`, not the card primitive. The repeated real frames:

| Look | Uses | → | Examples |
|---|---|---|---|
| `bg-cream border border-ink/10 rounded-2xl p-5` | 27 | frame · radius 22 (△ vs 14) | `app/(shell)/help/page.tsx:140` · `app/admin/compliance/_components/compliance-form.tsx:117` |
| `bg-surface border border-ink/10 rounded-2xl p-5/p-6` | 19 | frame (same look, other white token) | `app/dashboard/[eventId]/live/page.tsx:278` · `app/dashboard/[eventId]/studio/guest-columns/page.tsx:146` |
| `bg-cream border border-ink/10 rounded-xl p-4` / `p-3` | 17 + 15 | frame · 14 | `app/_components/push-toggle.tsx:189` · `app/_components/file-upload.tsx:1787` |
| `bg-terracotta/10 border-terracotta/30 px-4 py-3 rounded-md text-terracotta-700` | 21 | notice · gold | `app/(shell)/help/page.tsx:353` |
| `bg-warn-50/60 border-warn-200/60 … text-warn-900` | 18 | notice · warn | `app/_components/chat-message-stream.tsx:1843` |
| `bg-mulberry/5 border-mulberry/70 border-t-[3px] rounded-xl/2xl` | 11 + 11 | needs-action edge (sheet rule 11) | `app/dashboard/[eventId]/_components/read-refused-notice.tsx:37` · `app/admin/approvals/page.tsx:252` |

⚠ Your 2026-10-11 ruling is *"only have frames if something needs to be clicked."* Sheet rule 2 is "rows, not cards". **A Card primitive must not make non-pressable boxes easier to draw.** Recommended: the primitive is `Frame` with `as="button" | "a"` (pressable) or `kind="notice"`. A read-only group uses the existing `Section`, which has no frame.

## 6 · Intentional exceptions: left alone, listed

| What | Where | Uses | Why |
|---|---|---|---|
| Guest Event Hub | `app/[slug]/**`, `--hub-*` (121 defs), `--pahina-*` | hex 96 · arbitrary 57 · frames 340 | Couple-chosen look; exempt by DECISION (2026-10-08, ratchet `TEMPLATE_EXEMPT`) |
| Colour-name data | `lib/color-vocabulary.generated.ts` (428) · `lib/color-names.ts` (308) · `lib/palette-styles.ts` · `lib/invite-themes.ts` (108) | ≈ 1,000 | They are colour *values the user picks*, not UI chrome |
| Generated art / 3D / monogram | `lib/monogram-studio/*` · `lib/reveal-materials.ts` · `app/_components/plan3d/**` (venue-decor 69, booth-props 69) · `lib/reception-scene.ts` | ≈ 400 | Illustration / WebGL materials |
| Front-door + home marketing demos | `app/_components/home/home-reskin.css` (207) · `frontdoor/*.css` (94) · `*-demo-overlay.tsx` · `studio-card-demo.tsx` (41) · `app/tour/**` | ≈ 450 | Brand moments / demo mock-ups; the front door is ratchet-exempt |
| Print, PDF, email, OG images | `*print*`, `*pdf*`, `keepsake*.css.ts`, emails, `opengraph-image` | 248 + 9 + 13 | No app stylesheet reaches them (server-drawn) |
| Admin's own consoles | `app/admin/ugat/_components/ugat-console.css` (78) · `app/admin/connection-logs/*` (41, own palette) · `app/admin/colours/*` (37, the colour editor's preview) | 156 | ⚠ **Ask:** Ugat and connection logs use their own palettes on purpose? Colours preview must show raw values |
| Tests and dev labs | `*.test.ts`, `app/dev/**` | 3,838 + 388 | Not shipped |

## 7 · Proposed Phase 3 batches (one PR each, after Phase 2)

Each batch is limited to files no open template-wave PR touches (§0 table). Re-check `gh pr list` before each one.

1. **Shared pieces.** Wire `.sn-tile`, `.sn-row`, `.sn-card`, `ActionButton`, `.button-*` and `Sheet` to the component tokens. ~1,800 call sites move with no file touched.
2. **Exact-hex swaps (⓪ only)**, area by area: supplier (48) → admin (288, minus §6) → couple (453) → public (964, minus §6). These are pixel-identical by construction.
3. **Type-scale swaps (⓪ only):** `text-[11px]` → `text-sn-xs` and so on, area by area.
4. **Hand buttons → `ActionButton` with the exact-match variant.** Top 8 looks first.

Every △ row above is the **restyle task**, not this one.
