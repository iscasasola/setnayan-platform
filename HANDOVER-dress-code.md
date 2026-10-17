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

## State
- [x] fixtures
- [ ] before shots
- [ ] fix + guard + sabotage
- [ ] after shots, PR
