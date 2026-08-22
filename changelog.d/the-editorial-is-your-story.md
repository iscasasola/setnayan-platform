## 2026-08-21 · fix(editorial): correcting the story we wrote about you is free

Owner 2026-08-21: *"make this feature part of free and not part of the event hub
pro."*

**Setnayan already auto-writes every event's editorial.** `composeCopy` builds the
headline, kicker, byline and deck from the couple's own names, archetype, years
together, venue and tone, and the editor opens **pre-filled** with it.

Until now a non-PRO couple met a paywall instead — *"Author your front-page
story … It's part of Event Hub PRO"* — so **the story Setnayan had already
written about them was visible to them only as a price.** Two gates, both
retired: the `WebsiteProLock` on the page and the refusal inside `saveEditorial`.

🔑 **The owner's reason, worth keeping:** an auto-written story its own subject
cannot correct reads worse than no story at all, and the first name a generator
gets wrong is the couple's own.

⚖ **PRO STILL SELLS THE PREMIUM TOUCHES** — chapter curation, section order and
manual guest wishes remain gated, and a test pins that in BOTH directions so this
fix cannot drift into "everything is free". The word fields were already free;
what was gated was *starting* an editorial at all.

### ⚠ A correction to my own earlier report
I told the owner the auto-craft *"has never once run"*, reading `generated_at`
being null on all 7 rows. **That was wrong.** The composition happens at READ
time on every render — it is not stored, which is why the column is empty. What
has genuinely never happened is a couple **editing** or **publishing** one
(0 and 0), and now I know why: the editor was behind a wall.

**Guards:** 3 assertions, all mutation-checked with counts printed before → after,
all RED — including one proving the premium extras did not become free.
🪤 One mutation had to be retargeted: its anchor was a line this change had
deleted, so it landed nowhere and read as a pass (0→0). **A mutation that cannot
find its anchor is not a result.**

⏭ **STILL TO BUILD** (owner-ruled, not yet done): the plain editor — today it asks
for Eyebrow · Headline · Sub-headline · Pull quote · Byline, i.e. a couple to be a
magazine sub-editor, while the chapter composer already asks in plain words; the
three-state audience (**only me · private = the event's guests · public**, owner's
own definition, NOT the unlisted-link model); and an account-level link, since the
editorial is reachable only from inside an event's website section.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-21 row already records both rulings.
