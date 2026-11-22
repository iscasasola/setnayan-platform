# #8076 — a failed seat read says so · 375 light / 375 dark / desktop

Lab: `/dev/me-lab?stage=1&seat=none|unreadable|Table%203` (`&dark=1` = the couple's Candlelight look) on `next dev`,
no database, no sign-in. The line is the REAL `SeatDoorLine`, mounted above Me exactly as `app/[slug]/page.tsx` does.
Playwright, deviceScaleFactor 2. Each shot scrolls to the line with Me under it. The dev "Issues" badge is hidden.

The images are published as an Artifact ("Seat read proof · #8076", linked in the PR's STATUS comment), not committed —
18 shots at 2× are ~25 MB. Re-take them with the lab URLs below.

| look (Artifact image name) | not seated (read OK) | seat read FAILED | seated |
|---|---|---|---|
| 375 light (lab photo) | `375-light-none.png` | `375-light-unreadable.png` | `375-light-seated.png` |
| 375 light, plain paper | `375-light-plain-none.png` | `375-light-plain-unreadable.png` | `375-light-plain-seated.png` |
| 375 dark (Candlelight) | `375-dark-none.png` | `375-dark-unreadable.png` | `375-dark-seated.png` |
| 1280 light (lab photo) | `desktop-light-none.png` | `desktop-light-unreadable.png` | `desktop-light-seated.png` |
| 1280 light, plain paper | `desktop-light-plain-none.png` | `desktop-light-plain-unreadable.png` | `desktop-light-plain-seated.png` |
| 1280 dark (Candlelight) | `desktop-dark-none.png` | `desktop-dark-unreadable.png` | `desktop-dark-seated.png` |

Read back from the rendered line (`innerText`): "Find your seat →" · "Couldn’t load your seat — Reload" · "Your seat · Table 3 →".

⚠ On the lab's photo in LIGHT, the line is hard to read — the shipped "Find your seat →" line equally so (it sits on the
page ground, not on a plate). Pre-existing, listed as a gap in the PR's STATUS; the plain-paper rows show the words.
