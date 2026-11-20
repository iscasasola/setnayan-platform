# Event Today, Focus shape — shots (20 Nov 2026)

Taken from `/dev/home-lab` (fixture data: "Ana & Miguel"), `next dev`, Playwright, device scale 2. **Not real data**: this
cloud container has no Supabase credentials, so no signed-in page could be drawn. The fixture's eyebrow date (13 Mar
2027) and countdown date (12 Dec 2026) disagree — that is the lab's own fixture, not the page.

| file | what |
|---|---|
| `375-light.png` / `375-dark.png` | the card, "Needs you today", the kept sections |
| `375-light-open.png` / `375-dark-open.png` | a normal row tapped open: its answer, "Open in Event Hub ›", "Do it tomorrow" |
| `1280-light.png` | the three-column board: the list in the left column under the card; Budget leaves out the strip's payment |

The lab's plan tasks carry no tick (`labTodoFacts`), so they show the list icon; real plan tasks wear `PlanningTick`
(`home-now-never-repeats-below.test.ts` test 3 renders it). "3 Issues" is Next's dev overlay.
