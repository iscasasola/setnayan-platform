# HANDOVER — rd/dress-code-shows-every-pick (2026-10-17)

Task: the guest page's Dress Code must show every pick the Studio › Mood Board & Dress Code editor saves, and nothing
the couple did not pick (owner 2026-10-17: "if on moodboard&dress code, nothing is picked, then nothing should show").
Also: every colour dot says what it colours (owner: "for the dress code of women, there are palettes but no indication
of what the colors control").

## Measured (prod, SELECT-only, 2026-10-17)
- cale-ice's DRAFT held every Studio pick; the live config did not, until the owner pressed Apply at 06:32Z.
  The editor writes the draft; the guest page reads live. Most of the measured fault was "not applied yet".
- Still wrong AFTER Apply (live page re-read): rows the Studio has no row for (Maid/Matron of Honor, Best Man / Best
  Woman, Wedding Party) from old palette keys; per-ROLE lines from the old dress-code panel ("Parents of the Groom ·
  Long gown" — tells a father to wear a gown); "Our colours" = the five Mood Board colours + six frozen colours from the
  old panel's `dress_code_config.palette` (11 vs 5); chips carry no word for what they colour; a pick with colours and
  no Wear is drawn in an assumed garment.

## Lab
- Guest: /dev/maker-lab/guest?attire=cale (pre-Apply) · ?attire=cale-now (post-Apply)
- Editor: /dev/details-lab?look=1&studio=1&attire=cale (Studio › Mood Board on fixtures)

## Root causes found
1. Studio read its config through `normalizeDressCodeConfig`, which dropped `women` and roles.bride/groom/guest/celebrant
   (`sanitizeRoleAttire` filter = entourage labels only) → editor showed "Not said yet" for saved picks after reload,
   next save wiped them. Fixed (`isDressableRole`, women kept).
2. Guest general view built from palette KEYS + per-role tier → rows/lines the Studio doesn't have. Now ATTIRE_ROWS + picksOf.
3. Older dress-code form (Maker scene › Content) = a second writer (global Wear ▾, Palette). Wear now read-only there, palette removed (carried).
4. Our colours appended config.palette (6 seeded) to the five → five only.

## Decisions taken (owner questions in the report)
- dot words: one-zone design → its name ("Long gown"); past zones → "Accent"; no Wear → "Outfit".
- no figure for a person without a picked Wear (guest page + reader panel).
- per-role tier read only for celebrant/bride/groom/guest (`studioRowOf`).

## State
- [x] fixtures · [x] fix + guard · [x] PR #6602 draft, do-not-auto-merge
- [x] targeted tests green locally (14 files) · [x] sabotage: 9/9 red on their intended test
- [x] before/after shots at 375 → ~/Documents/Claude/Projects/shots-2026-10-17/dress-code/ (and /6602/)
- [ ] CI green (watch: one loop)
- Walk lesson: this scratchpad is SHARED with sibling builders — use a private subdir + port (dc6602, 3671).
