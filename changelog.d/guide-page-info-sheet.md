## 2026-11-22 · feat(help): Guide & Help — Help home to the drawing, the topic page, the guide page and the ⓘ sheet

Owner "Approved" (21 Nov 2026), re-confirmed 22 Nov, on `Setnayan-specs/prototypes/guide_help_2026-11-20/index.html`
(DECISION_LOG 2026-11-21 "GUIDE & HELP DRAWING APPROVED"). Stacked on #7614 (Help asks first).

- **Help (screen 1):** "Help · Ask it your way. English or Tagalog." · the ask box · **Start here** (the first three
  guides) · **Topics** (three rows + **All N**, `/help/topics`) · **Message us** as one row. The shipped form opens in
  the house `Sheet`; `#contact` and the prefill doors still open it. The People ask chips and their reader are gone, as
  the drawing says.
- **Ask (screen 2):** **Full guide** sits beside Take me there when the answer's topic has a guide.
- **A topic (screen 3), `/help/topics/[key]`:** the name and its line, Guides on top, then Answers, one open at a time,
  each with Take me there and Did this answer it?. `?open=<slug>` opens one answer already.
- **A guide (screens 4–5), `/help/guides/[key]`:** Guide · Hosts, the title, "N steps · about N minutes", numbered
  steps with the real app picture (the feature page's 375 px capture), Did this help?, Ask a question, ⋯ › Report a
  problem (both open Message us prefilled), and **Take me there** pinned at the thumb.
- **The ⓘ sheet (screen 6):** a 44 px round on the Guests pinned row → **Show me** (replays the page's spotlight tour;
  drawn only while the tour is mounted) · **Answers** (three, opening in place on their topic) · **Read the full guide**.
- **No guide words are written.** A guide's steps are its page's shipped spotlight tour (`lib/help/guides.ts`), following
  the plan's "words are written once" rule and the 21 Nov pause on writing new guides. There are six host guides:
  guest list, seat plan, budget, suppliers, mood board and memories.
- **Not built:** Practice (the frame engine is paused plumbing) and Questions on a guide (there is no store yet; a guide
  with no questions shows no Questions part). The ⓘ is on Guests only for now.
- Guard: `lib/help/guides-are-the-tours.test.ts`. Dev lab: `/dev/help-lab` (the host's help with no database);
  `/dev/guests-lab?spot=page` shows the ⓘ with Show me.

SPEC IMPACT: None. This builds the approved drawing; Practice and Questions stay open in `GUIDES_HELP_AND_I_PLAN_2026-11-20.md`.
