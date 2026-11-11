# PR #7458 · the one clock · Now beside Proposed

Each picture puts **Now** (`main` @ `5419656`, this branch's merge-base) on the left and **Proposed**
(`claude/fervent-lamport-8ak7qu` @ `9628a7c`) on the right. Both show the same event at the same instant.

## How these were taken

- **Lab data only.** The sample event is "Ana & Miguel" (`/lab-ana-miguel`, Sat 21 Nov 2026; venue in Tagaytay, so the
  zone is Asia/Manila), plus a two-day copy (`/lab-ana-miguel-2d`, 21–22 Nov). Its guest is Bea Santos, RSVP attending.
  None of these people is real.
- **The database was a local stand-in.** It is an in-memory script that answers the app's database calls with those
  rows. The env was dummy (no `.env.local`). **No production database, no production URL, and never `cale-ice`.**
- **The code is unchanged.** Each tree ran `next dev` with its own code as it stands.
- **The clock was pinned on both sides.** The server's `Date` was set to the moment by a Node preload, and the browser's
  by Playwright's clock, so the page and the phone agree.
- **Two viewers:**
  - `stranger`: someone with the link but no pass. The picture is the top of the page.
  - `guest`: the invited guest with a valid pass. The page is scrolled once to load everything, then shown from the top
    with the bottom bar.
- **Sizes and themes:** 375 × 812 and 390 × 844, light and dark.
  - ⚠ The guest page draws **light in both themes** on both trees; it wears the event's own look. So the dark pictures
    match the light ones, and only the frame around them is dark.
- **Hub pictures:** `hub-*` opens `/<slug>/hub` directly as the guest. A hub that is shut sends the guest back to the
  event page.

File names: `<moment>-<viewer>-<width>-<theme>.png` · `hub-<moment>-guest-<width>-<theme>.png`.

## The moments (Manila time) and what each tree shows

| moment | Now | Proposed |
|---|---|---|
| `m0-week-before` · Sat 14 Nov 3:00 pm | Invitation | Invitation (same) |
| `m1-eve-8pm` · Fri 20 Nov 8:00 pm, the night before | **The Day already**: "Happening now · Watch the event live"; the guest gets "LIVE NOW · The wedding is happening" and a Live tab | Invitation; nothing live |
| `m2-day-0530` · Sat 21 Nov 5:30 am | The Day (same as m1); `/hub` opens "Happening now" | Invitation; `/hub` sends the guest back to the page |
| `m3-day-3pm` · Sat 21 Nov 3:00 pm | The Day: Live · Home · Camera · Me | The Day, **plus Memories** with no photos yet (ruling 6) |
| `m4-after-9am` · Sun 22 Nov 9:00 am | Still "LIVE NOW · The wedding is happening" for the guest and "Happening now" for a visitor, but the guest bar has already lost its Live tab (Home · Camera · Me) | Post Event: "Thank you for celebrating", Recap tab |
| `m5-after-3pm` · Sun 22 Nov 3:00 pm | Post Event (Recap) | Post Event (same) |
| `m6-week-after` · Sat 28 Nov 3:00 pm | Recap | Recap (same) |
| `m7-2day-day2-3pm` · two-day event, Sun 22 Nov 3:00 pm, its **last** day | **Post Event on the event's own second day**: "Thank you for celebrating", Recap | The Day: LIVE NOW, Live · Home · Camera · Memories · Me |
| `m8-2day-after-9am` · two-day event, Mon 23 Nov 9:00 am | Recap | Recap (same) |

`m0`, `m5`, `m6` and `m8` are controls: the two trees agree there.

## Not shot (and why)

These need a signed-in host or supplier session on the dashboard, which this pass did not build:

- the dashboard's Plan · Day-of · After menu;
- the live wall's `archive` vs `coming_soon`;
- check-in;
- the schedule's live strip;
- the supplier's "today" desk;
- the Help / features copy.

The PR's own guard covers these as logic (`lib/the-event-has-one-clock.test.ts`). None of them has a picture here.

## Found while shooting (not fixed; written up in the PR body)

1. **On Proposed, `/<slug>/hub` stays open after The Day closes.** At 9:00 am and 3:00 pm the morning after, it draws
   the "Just wrapped" hub, and the top-left **Live hub** pill links to it.
   - Pictures: `hub-m4-*`, `hub-m5-*`, and the guest pictures for `m4`.
   - Why: the page's pill and the `/hub` route still accept the day-of phase `post`. Only the room-links door moved to
     The Day.
   - The PR body says `/[slug]/hub` closes at 06:00 the morning after.
2. **The Live hub pill covers the SETNAYAN mark in the header**, at both widths and on both trees (an older layout).
   Pictures: `m4-after-9am-guest-*`, `m5-after-3pm-guest-*`.
