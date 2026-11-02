## 2026-07-26 · feat(guest-site): Pahina tail — hero cover parallax + After-Event memento

Closes the two items wave A deferred with reasons (see `pahina-pr5-motion.md` "Deferred out of
PR-5" and `pahina-pr4b-keepsake.md`). Design §6 (motion vocabulary) and §11 (the Five Timelines,
After Event column). Guest tree only — `apps/web/app/[slug]/**` plus one pure helper in `lib/`.

### 🐛 Found first: the cover plate has been rendering at zero height since PR-2

PR-2 demoted the hero photo below the type as a "cover plate". `HeroBackgroundMedia` renders its
`<img>`/`<video>` as `absolute inset-0` — correct for the OLD hero, which was a banner holding the
names and date **in flow** and therefore had a height of its own. The new plate wraps that media in
a box with **no in-flow child at all**, so it computed to zero content height and the couple's hero
photo has not been visible on it since. The plate is given an explicit ratio — `aspect-[4/5]` on a
phone (it reads as a magazine cover) and `sm:aspect-[3/2]` from 640px up, so a 720px column doesn't
become a 900px-tall photo. This is a precondition for the parallax, not a nicety: there is nothing
to translate inside a zero-height box, and the "never clip the photo" requirement is unmeetable
without a real box. **Worth an eye on the preview** — it is the first time the plate will actually
show a picture.

### 1. Hero cover parallax (design §6)

The plate's media layer drifts ±6% of plate height as it moves through the viewport. One inline
script (`PahinaCoverParallax`), `rAF`-throttled behind a dirty flag, passive scroll/resize
listeners, skips layers that are off-screen. Server component — no client bundle, no hydration.

**Safety is the requirement, so the script never writes `transform`.** It writes exactly one custom
property, `--pahina-parallax`, and only a rule scoped to `.pahina-js` reads it. That one choice
inherits PR-5's whole fail-visible contract for free, plus a fourth exit:

1. no `IntersectionObserver` → `PahinaMotionRootFlag` withholds `.pahina-js` → no transform;
2. `prefers-reduced-motion` → same withholding, plus a belt-and-braces CSS block;
3. the **2s self-heal** removes the flag if the observer never ran → the transform vanishes *in the
   same frame*, even though the parallax script already wrote its property (nothing else reads it);
4. this script itself never running → the property is never set → the rule's `0%` fallback applies.

Every one of those lands on the same result: a plain, centred, static `object-cover` photo. Had it
set `el.style.transform` directly, exit 3 would have frozen the image mid-offset — which is exactly
the "visibly broken hero crop" PR-5 held this back to avoid.

**Why scale 1.16.** The layer is `absolute inset-0`, so its height is the plate height H, inside an
`overflow-hidden` box. `scale(1.16)` about the centre overhangs 0.08H top and bottom; the script
clamps the offset to ±0.06H. At either extreme the near edge sits 0.02H **outside** the plate, so
~2% of plate height (≈9px on a 375px phone) of overhang stays hidden under the clip at all times —
no gap, no letterbox, no bare corner, with margin left for sub-pixel rounding and the 1px border.
1.12 would be the exact-fit minimum and leaves nothing for rounding; 1.16 buys the margin for 4%
more crop. The two numbers are a matched pair and both say so in their comments.

Transform order is `translate3d(…) scale(1.16)`, not the reverse: functions apply right-to-left, so
this way the translate's percentage still resolves against the layer's **unscaled** height. Written
`scale() translate3d()` the 6% would be magnified to 6.96% and eat the margin.

Note both the ratio fix and the parallax land on **both** identity trees, because `PahinaMasthead`
is deliberately one component for every hero call-site so the two trees cannot drift (its own module
doc). That is intended here and is a different question from the memento's byte-identical
requirement below, which is about not leaking *guest state* onto the anonymous path.

### 2. After-Event memento (design §11)

`PahinaKeepsake` has supported `variant="attended"` — the "YOU WERE THERE" stamp — since PR-4b; it
was simply never mounted. It now mounts in the editorial (After-Event) takeover for an identified
guest who was there.

**The blocker PR-4b named was real:** the takeover is the `phasedBody` helper in `site-body.tsx`,
and that helper is shared by both identity tiers, so a guest-only node means branching a path that
also serves anonymous visitors. Handled with two independent fences rather than one:

- `phasedBody` gains an optional second parameter defaulting to `null`. `anonymousTree` calls it
  with one argument, so its editorial branch falls to the **same single `EditorialContent` element
  expression** it has always returned — byte-identical by construction, not by inspection.
- The node the guest tree passes is gated by `buildAfterEventMemento()` — a new pure module
  (`lib/pahina-memento.ts`, mirroring `lib/owner-ribbon.ts`) that denies any tier that is not
  `guest` **first**, before it looks at any presence signal. Redundant given the call site, and
  required anyway: the shared path is one refactor from being called with the wrong tier.

It returns a model whose `variant` can only ever be `'attended'`, so the call site cannot mount the
pre-wedding "Joyfully accepted" ticket after the wedding.

**Proof of presence is either signal, not both.** `arrived` (a `guest_checkins` row, already on
`guestHubData`) is the harder evidence and is honoured on its own — including for a guest who
declined and came anyway, a real PH wedding outcome. But door-scanning is optional and most events
never do it, so `rsvp_status === 'attending'` also qualifies; requiring the check-in would mean the
memento almost never appears. Neither signal → silence. No new query: both values were already in
scope in the guest tree.

The memento is a direct child of the returned fragment, so it lands as a direct child of
`<article data-pahina-chapters>` and the §6 observer reveals it as its own chapter — it is content,
not chrome (unlike `OwnerRibbon`, which is mounted outside the article for exactly that reason).

### Verification

`tsc --noEmit` clean · `next lint` 0 errors · **4180/4180** unit + golden tests pass (12 new in
`lib/pahina-memento.test.ts`) · production build compiles · repo guards `lint:changelog-dir`,
`lint:legibility`, `lint:radius`, `lint:masthead` all pass. Gate neutralised twice to prove the
tests bind it: forcing the `identityKind !== 'guest'` denial off fails the 4 anonymous tests;
forcing the `body !== 'editorial'` denial off fails the 3 phase tests. No new dependencies, no
client bundle, no migration. `lib/site-body-plan.ts`, the widget registry and the golden
expectations are untouched.

SPEC IMPACT: None. Both items were already specified (design spec §6 motion table row 2, §11 After
Event column) and are only now built; no locked decision moves.
