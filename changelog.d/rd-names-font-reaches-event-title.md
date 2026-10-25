## 2026-10-17 · fix(hub-fonts): the "&" follows the Names font, and a Names font handed back shows on the canvas

Owner, 2026-10-17: he changed Fonts › Names in the Maker and expected the Cover Scene's Event title to change; then
*"how about the &?"* — ruling: the "&" between the names follows the Names font, keeps its gold, italic where the face
has one.

Measured in the Maker lab (no database + 54321 stub) before the fix: a Names pick DID reach the canvas's Event title
with no reload — phone Studio (on returning from Look), desktop, the shipped Typeface row, every stage — but:

- the "&" stayed Fraunces on every masthead design (its own `font-pahina` class beat the inherited Names font);
- a draft that handed the font back ("Event Hub font") over a live one kept the LIVE font on the canvas until Apply —
  the canvas's drafted look (`HostDraftLook`) is a second scope inside the layout's, and the layout's names mark
  still reached the names.

Fix (`app/globals.css`, "THE COUPLE'S FOUR FONTS"): the names rule now holds only when no worn look scope without the
names mark sits between it and the names (the nearest scope decides — a guest's page, one scope or two that agree, is
unchanged); one more rule sets the Names font on the joiner (`data-hub-joiner`, stamped on every masthead joiner by
`joinerStamp` and on the sample's "&") with `font-synthesis-style: none`, so a face without an italic is drawn upright,
never faked. A joiner with its own font from Cover Scene › Edit keeps it (inline wins).

Apply / staleness (traced, no change needed): Apply calls `revalidateGuestSite(slug)` → `revalidatePath('/<slug>')`;
`/[slug]` renders per request on production (`cache-control: private, no-store`, `x-vercel-cache: MISS`, measured ×3);
Supabase fetches carry no cache option, so Next 15 reads them "auto no cache" at request time; the service worker is
network-first for `/[slug]`. Nothing can serve a just-applied font stale. The controller's one Fraunces load matches the
pre-Apply live value (`applied_snapshot.site_font_key = 'fraunces'`) — a load that raced the Apply.

Lab: `/dev/maker-lab`'s canvas now wears the drafted and the published fonts in the real canvas's two layers
(`lab_fonts_live` · `lab_fonts`), and the shipped Typeface row drafts there.

Guard: `app/[slug]/_components/the-names-font-reaches-every-name.test.ts` (evaluates the rules' selectors against every
scope nesting; renders every masthead design and asserts nothing inside the names wears a face the rule cannot reach;
Apply revalidates the slug). `lib/the-four-fonts-reach-the-page.test.ts` updated for the two rules.

SPEC IMPACT: owner ruling 2026-10-17 ("the & follows the Names font, gold kept, italic where the face has one") is not
yet in `DECISION_LOG.md` — for the controller to record (this builder was told not to edit the corpus checkout).
