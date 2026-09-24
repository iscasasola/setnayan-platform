**Model: Fable 5.1 (`claude-fable-5-1`) · Effort: medium**
Paste everything below the line into a new session. Replace `{{PAGE}}` with the route (e.g. `/dashboard/[eventId]/guests`).

---

# Clean up `{{PAGE}}`: less text, one clear flow

**The problem:** this page has too much text, too many descriptions, and what the user came to do
is scattered across the page. **The goal:** a clean page that feels like an app. The user knows
what the page is for at a glance and can do it in one straight line, without reading.

This is a **definition first, then a build**. Do not edit code until the owner confirms Step 3.

## Step 1 — Measure the page as it is (show the evidence)

Work from `origin/main`, never from `~`:

```bash
git fetch -q origin main
git show origin/main:"<the page.tsx for {{PAGE}}>"      # and every component it mounts
gh pr list --state open --limit 40 --json number,title,headRefName   # is someone already on it?
```

**Find the page's approved design before proposing a shape.** Search
`~/Documents/Claude/Projects/Setnayan/prototypes/` and `DECISION_LOG.md` for the page's name. If a
drawing or ruling exists, your job is to trim the live page back toward it, never to invent a new
structure. (Worked example: a Papic redesign proposed tabs; the owner had already ruled tabs OUT on
2026-08-27 in favour of one ordered page, `prototypes/papic_control_center_2026-08-25.html`.)

Open the **live page** (production) in the browser as a real user of that page. Take a screenshot
and use `get_page_text`. Then report:

1. **The job.** In one line: what the user comes to this page to DO. If you can't say it in one
   line, the page has too many jobs. List them.
2. **Text inventory.** A table of every block of text that is not a control label:
   `text (first ~8 words) | words | what it's for | keep / cut / shorten / move`.
   Include page intros, section descriptions, helper paragraphs, empty-state essays, banners and
   tooltips. Give the total word count on screen.
3. **The flow as it is now.** Number the steps a user actually takes to finish the job: every
   scroll, click, tab switch, modal and page jump. Mark each place the flow **scatters**: the
   next step is in another section, another tab, far down the page, or in a separate page; or the
   same action appears in two places.

## Step 2 — Define the clean version

**A. Text budget.** Say what survives from the inventory, and why:
- One title (a noun, not a sentence). At most one short line under it, and only if the page is
  unclear without it.
- Section headings are 1–3 words. **No description paragraphs under sections.**
- Controls say what they do in 1–2 words.
- Explanation moves into the interface: an empty state that shows the first action, an inline
  hint of ≤ 6 words, or a "?" / info tap. Never a paragraph above the content.
- **Keep** text that carries a fact the user needs to decide: money, dates, a status, an error,
  a consequence ("This cancels the booking"). Cutting those is a defect.

**B. The flow, straightened.** Rewrite Step 1's flow as numbered moves: one action, one visible
result each. Rules:
- The job's main action is the most visible thing on the page, and in the first screen.
- Steps sit in the order they're done, top to bottom (or left to right). No jumping back up.
- One primary button per step. Secondary actions go quiet (text link or "⋯" menu).
- An action lives in **one** place. Name the duplicates you are merging.
- Anything unrelated to the job moves out (to its own page, a tab, or a "⋯"). Say where it goes.

**C. Before → after**, one table: `section | now | after` with word count and step count as the
last two rows.

**D. Rough layout** as a text box diagram, showing only the structure, not new visuals.

## Step 3 — Decisions for the owner

At most 3, one line each, recommendation first (e.g. "move X to its own page", "drop section Y").
Do not ask anything the code or `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` already
answers. Grep it first and cite it. End with:
*"Confirm and I'll build it by trimming and reordering the existing components."*

## Hard rules
- **Trim and reorder, never rebuild.** Reuse the page's existing components, copy and styles. A
  redrawn screen or new component where one exists is a defect.
- **Don't remove a feature to remove its text.** Every capability the page has today must still
  be reachable after. List where each moved.
- **Every claim about the live page comes from the live page**, not from a code default or a comment.
- If a public page has a guard on its `h1`, canonical URL or structured data
  (`grep -rln "{{PAGE}}" apps/web --include="*.test.ts"`), keep them. Never edit a guard to go green.
- Keep the reply short: the tables, the flow, the diagram, the decisions. No essay.
