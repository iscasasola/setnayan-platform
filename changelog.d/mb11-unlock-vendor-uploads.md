## 2026-09-04 · feat(moodboard): the supplier upload page opens to the trades that supply it, with the safeguards that were never optional

MB11. The vendor moodboard-library page shipped in **May 2026 and has never been
used.** Three locks kept it shut and all three are opened here — none of them
alone, because the reason the locks were there is that the bucket is public.

**The trade gate was one service key.** `services.includes('reception_decor')`
excluded gown designers, florists, cake makers and rental houses — the exact
trades whose photographs a couple wants. It now derives from MB10's slot→trade
map (`canonicalServicesForSlot`), so adding a trade to a slot widens the gate or
does not widen it at all, never half.

**The page and the save disagreed about who may be here.** The page asked "do
you own a shop"; `actions.ts` asked `users.account_type === 'vendor'`. The page
rendered and the upload threw `vendor only`, with nothing anywhere saying why —
the same shape as `mayBroadcastOnSharedChannel`. One predicate now,
`lib/moodboard-library-access.ts`, imported by both, with a guard that fails if
either re-derives access on its own.

**The bucket had no safeguards.** Every upload now, in this order: a **rights
warranty** (`rights_warranted_at` + `rights_warranty_version` — MB10's columns,
no new ones), a **server-side SETNAYAN watermark**, the **three content checks**,
storage, then the **cross-vendor theft scan**. This was the one publicly-readable
bucket without one.

- **The watermark was already on this exact surface, and it was not a rule.**
  `stylist-library-editor.tsx` has called `watermarkFile` (Canvas) since May, but
  the upload is a server action — anything that can call it could hand it
  unmarked bytes, and the browser path looks identical either way. Moved to
  `lib/watermark-server.ts` (satori → vector paths → sharp composite; librsvg's
  fontconfig is flaky on Vercel, which `lib/social/card.tsx` already records).
  The client call is deleted so it cannot print twice.
- **Two of the three content checks are automated hard blocks with a message
  naming what was found** (owner correction 2026-09-03). Any decodable **QR
  code** blocks — deliberately a different rule from `vendor-qr-media-guard.ts`,
  which allows non-funnel QRs on a vendor's own website; the decoder is now
  shared (`lib/qr-decode.ts`) and the verdicts stay separate. The **vendor's own
  contact details** block, matched against *that shop's own* profile values, never
  a generic phone/email pattern — a sabotage test proves a generic pattern would
  bounce a photo of the couple's own save-the-date.
- **Back-catalogue quota, live from day one.** `galleryBackCatalogPhotos` —
  pro 20 / enterprise 100, the owner's two figures — added **alongside**
  `portfolioPhotos` (30…300), never over it. Only `source_event_id IS NULL` rows
  count; a photo from a celebration the shop was booked on is never rationed, at
  any tier. Because it is a check on new inserts only, grandfathering is the
  default behaviour and no rescue migration is needed.
- **`editorial_vendor_media` (built 2026-06-16, 0 rows) reaches the gallery
  pool.** The shop's own day-of photos can be promoted, with
  `selection_match_rank = 1` **re-checked at import** rather than inherited from
  submission, plus `moderation_state = 'clean'` and `hidden_by_couple = false` —
  a photo the couple hid on their own story never resurfaces on a stranger's
  board.

**Migration `20271202522764`** adds `moodboard_library_assets.source_event_id`,
widens `source` to `editorial_import`, and widens the `surface` CHECKs on
`vendor_image_hashes` / `vendor_image_flags` to `moodboard_library` — without
which every hash the scan wrote would have violated the check, been swallowed by
its own best-effort catch, and recorded nothing.

Two errors in that migration were caught by the PGlite replay and are written
into its header so the next author does not repeat them: re-listing the `source`
vocabulary from the ORIGINAL migration silently dropped `recraft_generated`
(added by the florals seed and used by live rows), and a
`CHECK (source <> 'editorial_import' OR source_event_id IS NOT NULL)` turned the
FK's SET NULL into a RESTRICT — a supplier's gallery photo would have blocked
deleting a celebration. `source_event_id` is now named in no CHECK, and a db test
asserts that by querying `pg_constraint`.

Guards, each sabotage-tested (broken on purpose, confirmed red, restored):
`lib/moodboard-gallery-upload.test.ts` (21) ·
`lib/moodboard-gallery-image-checks.test.ts` (11, on real pixels and a real
decoded QR) · `app/vendor-dashboard/moodboard-library/every-upload-is-screened.test.ts`
(13) · `tests/db/the-back-catalogue-quota-counts-the-right-rows.db.test.ts` (9).

🛑 **CI's exposure-freeze guard caught a hole this feature's own gate depended
on, and it is the most important thing in this PR.** Supabase grants table-level
ALL on every public table and a **new column inherits it silently**, so
`source_event_id` shipped readable AND writable by `anon` and `authenticated`.
The read half published which celebration each public gallery photo came off.
The write half was worse: `moodboard_library_assets_vendor_insert` admits a
supplier's own row, RLS is ROW-level and cannot constrain a column's VALUE, so a
supplier could POST straight to PostgREST with any `source_event_id` and their
upload would be event-linked — permanently outside the back-catalogue count. The
tier gate would have been one HTTP request wide, with every other test green.
Fixed by REVOKE-at-table-level then re-GRANT of a live-computed allow-list (the
`oauth_grants` SEC-8 shape; the naive column REVOKE is a documented no-op against
a table-level grant), with post-conditions that make the migration REFUSE TO
APPLY rather than ship looking fixed — proven by re-granting the column, which
stops the replay with `authenticated can still INSERT source_event_id`.

A second CI failure was a FALSE POSITIVE that must not be silenced:
`gates-have-handles` reads a column as written when one file both `.insert(`s the
table and names the column in a `column:` position — and a TypeScript type
annotation is that spelling. `editorial_vendor_media.hidden_by_couple` still has
**zero writers** (three readers, measured), so deleting its baseline line to go
green would have erased a real open finding: the couple's "hide this from my
story" control does not exist. The row type moved to
`lib/editorial-vendor-media.ts`, where nothing writes the table.

⚠ **TWO SESSIONS BUILT `lib/watermark-server.ts` ON THE SAME DAY.** MB9 (PR
#5170) shipped one for the render pool while this branch was in CI; the vendor
gallery needed the same thing. They are now ONE module — MB9's contract,
geometry and JPEG-only output kept verbatim, with two things folded in:

- **`imageRegionStats`**, the pixel-reading instrument this branch's guards use;
- **the glyphs are vector paths, not a font-family request.** 🔑 **This is a
  correction to a claim in MB9's docblock and it needs owner sign-off.** It read
  *"No font FILE is referenced… A generic family is available everywhere the app
  runs."* If that is wrong, the failure is silent and lands on a public gallery:
  the scrim composites, the pixels change, every pixel-reading test passes, and
  the mark is a blank grey pill. The repo's own shipped evidence points the
  other way — `lib/social/card.tsx` records *"librsvg's fontconfig path is flaky
  on Vercel"*, which is why every social card, the lockup PDF and the Papic
  display ref render text through satori with an explicit font buffer, and a
  grep confirms MB9's file was the **only** place in the codebase rasterizing
  SVG `<text>` through sharp. The wordmark now comes from satori + the bundled
  Poppins TTF, so no host font is consulted on any runtime. **If the
  DejaVu/Helvetica assumption was in fact measured against a Vercel lambda, say
  so and this can go back.** A new guard asserts the LETTERS are present, not
  merely that something was composited — sabotage-proven by dropping the
  wordmark layer, which leaves the scrim and turns the assertion red.

Two findings worth carrying: sharp's `.stats()` **ignores a preceding
`.extract()`**, so the first watermark guard read identical numbers for all four
quadrants and could never have failed; and a DCT pHash is **unstable on a
low-detail logo** (a bar on white hashes 28 of 64 bits from its own re-encode),
so the own-logo check now calibrates itself against a re-encode of the logo and
skips rather than returning a random verdict.

SPEC IMPACT: None. The 20/100 pair, open-now/gate-later, and the three content
checks are all recorded owner decisions (MB11 brief, 2026-09-03) — no corpus
decision is changed or added. Two residues are named for the owner rather than
resolved: no **solo** back-catalogue figure was given (it is 0 here, and a solo
allowance is an owner call), and a purely-graphic corner logo stamp is not
caught by a hard block and reaches the admin approval queue.
