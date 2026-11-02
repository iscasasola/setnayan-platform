## 2026-09-20 · feat(monogram): one mark, two doors — and an uploaded logo that finally wins everywhere

The Monogram Maker stacked both ways of getting a mark down one scrolling page:
the whole Vector Studio, a free/paid line, "upload your own" (carrying a SECOND,
differently-worded free/paid line), then a paid pitch. A couple who already had a
logo scrolled past an entire editor to reach the thing they came for.

**The page is now a chooser, then one door.** `?mode=design|upload` holds which,
so Back and refresh work and the App-Store "Get" CTA can still deep-link. The
chooser also answers a question the page never answered: *which* mark is live
right now, and which door made it. Researched against how Canva, Wix, Adobe
Express and Looka actually split "design it" from "upload yours" — none of them
stack the two.

**The paid unlock stopped being a section.** Before purchase it is ONE row beside
the reveal the couple just picked — what it does, and a button carrying the
catalogue price (`Animate & apply · ₱500`). The before/after pitch argued for
something already playing free a few centimetres above. Owned and under-review
states keep the fuller treatment. The price is fetched in exactly one place now;
the page no longer fetches its own copy.

**Uploading a logo now actually replaces the designed mark — everywhere.** The
green banner has promised "it outranks the studio mark everywhere" since
2026-07-17. It did not. Seven surfaces read `monogram_custom_svg` directly or
failed to select `monogram_uploaded_svg` at all, so a couple who uploaded their
designer's logo kept seeing the mark they had replaced on: the account switcher,
the album shelf, the photos tab, their public `/u/` profile, the shareable social
card, the admin social queue, the seating export, the mood-board concept PDF and
the public profile loader. `lib/the-mark-is-resolved-everywhere.test.ts` holds
the line in both directions — no bypass, and no select that fetches one column
without the other — with a caller floor so it cannot pass by emptiness. It went
red on three surfaces I had not found by reading.

**"Follow our mood board" (new).** An uploaded mark can wear its own colours or
the couple's reception colour. The policy rides on the mark as `data-ink` on the
root `<svg>`, never in a column: the twelve read sites disagree about which
columns they SELECT, so a column-borne policy would have applied on the hero and
not on the QR code. `palette` returns every fill/stroke as `currentColor`, so the
surface's own themed ink paints it and no caller learns about palettes. The
stored bytes keep the original colours, so the choice is reversible — which is
what makes comparing it honest. Structural paint (`fill="none"`, gradient refs,
`fill-rule`) is preserved; flooding a hollow counter would pass a byte-diff and
ruin the mark, so each is asserted by name and count.

Comparison is a drag-to-wipe over one full-size mark (a native `<input
type="range">`, so keyboard- and screen-reader-operable for free), with two
buttons recording the decision. A toggle alone does the choosing well and the
comparing badly. The mood-board side previews against the couple's REAL
reception colour, and is withheld entirely when they have not picked a palette
rather than faked against a stand-in.

**Upload tips, said before the upload.** The only guidance was error copy, which
by definition arrives after a couple has already failed. Every line is a property
of the real decoder (`lib/monogram-studio/trace.ts`) — alpha-channel vs luminance
tracing, the 40-piece ceiling, why a PNG on a white rectangle traces the
rectangle.

Also: `saveUploadedMarkAction` and `clearUploadedMarkAction` now count updated
rows. A PostgREST UPDATE matching no row returns `error: null`, so an RLS refusal
redirected to "your mark is live everywhere" with the column untouched.

SPEC IMPACT: None — no locked decision changes. The ₱500 price is read from
`platform_retail_catalog_v2` as always; nothing here hardcodes it.

OWNER CALL (not actioned): `OUT_ANCHORS.animated_monogram` is ₱15,500 against a
₱500 price — a "save ₱15,000", 31× bargain claim on the onboarding screen. The
same file removed both Papic anchors at 32× for exactly this, writing "silence is
honest, a fake bargain is not". Flagged, not changed: a pricing claim is the
owner's.

### CI follow-up · the back link is two links

`lint-port-no-lost-controls` failed: `/dashboard/[eventId]/monogram` "can no
longer reach /dashboard/[seg]/studio". The link was still there, but only as one
branch of a ternary `href`, and that guard reads routes statically. Nothing had
actually been removed — so regenerating its baseline would have recorded a
removal that never happened.

Fixed at the page instead: two plain links, each with one destination. A route a
static reader cannot find is a route the next refactor deletes with nothing going
red, so the guard was right to object. It also reads better — from inside a door
you want "the other way", and add-ons is one level further out.

### CI follow-up · a narrow read is now baselined, not widened

`lint:dup-rule` GUARD 2 flagged `social-queue-surface.tsx`'s hand-typed
`events` select as a NEW omission against `HERO_MONOGRAM_COLUMNS`, because
this PR's own fix (reading `monogram_uploaded_svg` through
`resolveEventMonogramSvg` so the queue publishes the mark the couple actually
uses, not a replaced `monogram_custom_svg`) pushed the overlap with that
constant past the guard's threshold for the first time.

The admin queue does not need the rest of the list — `resolveEventMonogramSvg`
reads only `monogram_uploaded_svg` and `monogram_custom_svg`; the studio design
columns (`monogram_color`, `monogram_font_key`, `monogram_frame_key`,
`monogram_motion_key`, `monogram_studio_config`, `monogram_style`,
`monogram_text`) are never referenced by this surface. Selecting the whole
constant here would fetch seven columns nothing on this page reads. Deliberate
narrow read, regenerated per the guard's own escape hatch
(`pnpm --filter @setnayan/web dup-rule:baseline`); the same regen also drops 4
previously-baselined `monogram_uploaded_svg` omissions this PR's own changes
already closed elsewhere.
