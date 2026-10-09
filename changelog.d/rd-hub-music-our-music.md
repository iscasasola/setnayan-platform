## 2026-10-08 · feat(studio): Look › Music › Source ▾ — Our music or Your music

- **Source ▾** in Look › Music (both Makers): **Our music** — Setnayan's own songs, by mood, free to
  use — or **Your music**, the couple's own upload (unchanged). Picking a source only changes what is
  drawn; it writes nothing.
- **Our music** shows the Song row and, on tap, the list by mood with ▶ on every row. A tap on a song
  goes into the draft like every Look change; ✓ Apply publishes it. The list is the tracks an admin
  published at `/admin/hub-music`; it loads lazily (the `maker-details` chunk).
- **No new column and no migration.** The pick is stored where the song already lives —
  `events.site_bg_music_r2_key`, holding a reference into `hub-music/` — so the guest page plays it
  through the shipped `BackgroundMusic`. Which source a song came from is read off that reference
  (`lib/hub-music-ref.ts`).
- The form names a TRACK; the server looks its file up, and only a published track resolves. Apply
  admits the song only while its track is published, and says "is no longer on our music list" when
  it is not.
- **An Our-music pick is free at Apply** (the approved prototype's words: "free to use"); the couple's
  own song stays Event Hub Pro.
- Deleting an event never deletes a shared track's file (the event's cleanup scope is its own folder),
  and a track removed from the list keeps its file while any Event Hub still plays it.

SPEC IMPACT: `HUB_MUSIC_BUILD_STATUS_2026-10-08.md` (corpus). Surfaced for the owner, not decided
here: whether some Our-music tracks should be ◆ (the DECISION_LOG row says "free or ◆"; the table has
no such flag and every track is free).

## 2026-10-08 · feat(look): Music — Source ▾ Our music · Upload your own, ported onto the new Look (amendment PR 6, step 1)

Owner, verbatim (2026-10-08): *"Pick a music from our listing or upload your own"*. The couple
side of #6434 (`rd/hub-music-our-music`) could not be merged into the new Look (it conflicts);
its two commits — 45e761e99 (Source ▾) and c83810021 (the own-song guard) — and its two
follow-up fixes (d2c2a2b04, 35ac984f0) were applied by commit onto this stack. They applied
clean but for the generated port baseline, which was regenerated on this tree. Everything
above this entry is that branch's own changelog. Local commit.

What the port changes against the branch:
- **The second source reads "Upload your own"** (the owner's words; it was "Your music").
- The list's lazy door lives in `scene-styles-lazy.tsx`, the file the Maker warms when idle
  (`maker-tools-are-all-preloaded` requires it) — and the Studio's four font rows moved to the
  same door: that guard was RED on the fonts commit (a8dbfaf9b) and I had not run it.
- The dev lab hands the Music panel three sample songs with no address, so the list can be
  seen there; nothing is fetched or played from the lab.

Refusal words are the branch's, verbatim (`ownSongProblem` / `hubMusicFileVerdict`,
`lib/audio-sniff.ts`) — e.g. "This file is Opus audio in an .m4a wrapper, which does not play
on every iPhone. Export it as AAC or MP3."

Requests (read from the code, not counted with a stub):
- **The Maker's server render: +1 read** — `hub_music_tracks` (published rows), inside the
  page's existing `Promise.all`. BEFORE: 0. ⚠ It is asked on EVERY Maker render, not only
  when Music is opened (the design note says "one list read on opening Music"); asking it on
  open instead needs a new server action or route, and the budget for those is +0. Each
  row's ▶ address is worked out without a request; a preview streams only after ▶.
- A pick from our list: the form's one draft write + 1 read (the track's file, by id,
  published only). An own-song upload: unchanged, plus the bytes are read ON THE DEVICE
  before sending (no request).
- ✓ Apply: +1 read only when the draft holds one of our songs (is its track still published?).
- Exported server actions: 1200 → 1200 (+0).

Guards (the branch's own, ported): `our-music-is-a-pick` 9 · `your-music-plays-on-phones` 5 ·
`hub-music` 13 · `audio-sniff` 13. Re-aimed here, with the reason in each:
`our-music-is-a-pick` (the label; the lazy door's file) · `the-look-is-one-panel` (6) (the
song now drafts from two doors; the two parts are split at the part's own else).
4 sabotages of my adaptations seen red; a 5th stayed GREEN and is said: giving the list a
chunk of its own is not caught by the preload guard (it only asks that the piece is warmed) —
`our-music-is-a-pick` catches it.

NOT in this commit (PR 6, steps 2–3): the guest's music button in three designs; converting a
song on the device.

SPEC IMPACT: None beyond the contract above.

## 2026-10-08 · perf(look): Our music's list is ONE cached read for every couple — the Maker's render reads it 0 times

Controller's ruling, 2026-10-08 (the owner's least-requests rule): the port above read
`hub_music_tracks` on EVERY Maker render — and the Maker's open is the page the owner
measures. The list is the same for every couple (the published rows), so it is now served by
the repo's own cached-read pattern, exactly as `lib/loader-settings.ts` and
`lib/brand-settings.ts` do it. Local commit.

- `lib/hub-music-server.ts`: `loadPublishedHubMusicRows` = `unstable_cache` under the tag
  `hub-music-published` (1-hour backstop), read with the service client — published rows
  only, by the query's own filter. ROWS are remembered, never a ▶ address (worked out per
  render). A refused read THROWS inside it, so it is never remembered: the next render asks
  again, and the picker says "couldn't load".
- `app/admin/hub-music/actions.ts` (the one writer — add · edit · remove):
  `revalidateTag(HUB_MUSIC_TAG)` after every successful change.
- The two GATES are not cached — a pick's lookup and Apply's "is it still published?" re-read.

Requests: the Maker's server render **1 → 0** reads of `hub_music_tracks` (1 for the first
render after an admin change, or after the hour). A pick and Apply: unchanged.

Guard: `our-music-is-a-pick` (10, new) — the wiring, each way; (5) re-aimed with the reason.
6 sabotages seen red: the render reading the table itself (two ways) · a refusal remembered
as an empty list · no tag · unpublished rows in the list · the admin not busting the tag.
⚠ NOT run: the cache itself (it needs the Next server) and any read of the table (no
database here). The guard holds the wiring; the first real render is the proof.

SPEC IMPACT: None.

## 2026-10-09 · feat(look): the guest's music button comes in three designs — Moving bars · Record · Note

Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5";
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E), verbatim: *"music icon can be that
animated moving bars. can we make them choose 2 more designs?"* Local commit.

**What a couple sees.** Studio › Look › Music, under "Play music on my Event Hub": a row
"Music button" with the three designs drawn as the REAL control (the guest's own round, each
moving as it does while the song plays), the picked one ringed. A tap rings it, shows it on the
sample screen at once, and adds "Your music button" to the draft; ✓ Apply puts it live. With
no song chosen the row is one quiet line: "Pick a song first". Free.

**What a guest sees.** The same round button in the same corner. Moving bars is the shipped
face, byte for byte (three bars while the song plays, the muted speaker before). Record is a
disc that turns while the song plays and rests when it stops; Note is a note with two rings
pulsing out while the song plays, none when it stops. Nothing moves before the guest's own
tap, and nothing moves under "reduce motion". One colour — the page's accent-as-text token
the button already wore, so it follows the five and the ground as the eyebrows do.

- `lib/hub-music-button.ts` (new, pure): the three designs, `sanitizeHubMusic`,
  `hubMusicButton(config)`, `hubMusicButtonWrite`. Stored at the hero row's
  `config_json.music.button`, beside `main` — **no migration**. Only `record` / `note` are
  ever stored; "bars" takes the key off, so an event that never chose reads as before.
  ⚠ DEVIATION from the contract's wording ("`sanitizeHubMainGround`'s file gains
  `sanitizeHubMusic`"): it is its own small file, so the guest page's music button does not
  pull the whole canvas library for one three-word check. Same key, same reader shape.
- `app/[slug]/_components/music-button-face.tsx` (new): `MusicButtonFace({ design, playing })`
  and `MUSIC_BUTTON_CLASS` — the ONE drawing of the control, worn by the guest's button, the
  Maker's three cards and the sample screen. `background-music.tsx` takes `design` and draws
  it; `site-body.tsx` hands it `hubMusicButton(heroRow?.config_json)`.
- `app/globals.css`: `sn-music-spin` · `sn-music-ring` — transform and opacity only, worn
  only while playing, named off under reduce motion.
- The draft: `widgets.hero.music` in `lib/hub-draft.ts` (sanitise · overlay · classify, free ·
  label "Your music button"), the Apply key in `hub-draft-actions.ts`, the change line
  "Music · Music button".
- `editor/_components/music-button-row.tsx` (new, lazy through `scene-styles-lazy.tsx`,
  mounted by the Music form): control → kind: the three → **Choice cards** (the thing itself,
  like the button shapes). The sample screen's speaker is now the real control in the
  couple's design (`look-sample.tsx`, `look-sample-store.ts` key `musicButton`).

Requests: opening Music **+0** (the design rides the hero row the Maker already read); a pick
= **1** held draft write (`makerSave(…, { held: true })` — no whole-Maker render, no canvas
redraw); the guest page **+0** requests and no image (spans and inline SVG).

Weight, measured by file (minified + gzip), not on a build: `hub-draft.ts` +136 B ·
`hub-music-button.ts` 306 B whole (the draft library uses the key and the sanitiser only).
The row, the face and the CSS are outside the Maker's first load.

Guard: `lib/the-music-button-has-three-designs.test.ts` (6, new) — what is stored · every
face rendered at rest and playing · the CSS · the guest mount · the draft both ways · the
Maker's row rendered. `the-look-sample-is-the-guest-look` (4b) now asks for the design on the
sample. 36 sabotages seen red (34 in the new guard, 2 in the sample's), each restored.

**Three guards that were RED since the Our music port (7fade4ab7) and are re-aimed here —
each pinned a spelling or a distance, not its claim; the product was right:**
- `studio-round-3-follows-the-owner` (6): counted three `onChange={draftNow}` → now asks,
  per control, that the song, the switch and the video each reach `draftNow`; and measured
  ≤ 400 characters between two column names → now cuts the draft branch out whole and asks
  that each form field's own block sets its column. 6 sabotages red.
- `try-then-pay-the-last-three` (1): looked for the draft return within 900 characters of the
  door → now asks for the ORDER (the door returns into the draft before the first Pro
  question). 2 sabotages red.
- `our-music-is-a-pick` (7): pinned the import line to one name → now asks that the list
  comes through the lazy door and from nowhere else. 1 sabotage red.

⚠ NOT seen in a browser yet at the time of this entry, and NOT run: any save (no database
here), the real Maker (sign-in), a real phone.

SPEC IMPACT: None — the contract's § 2.E is built as written, except the file the sanitiser
lives in (above).
