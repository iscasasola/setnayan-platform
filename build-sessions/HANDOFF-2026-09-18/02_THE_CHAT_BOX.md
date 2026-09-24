# The chat box — what it is, what shipped, what is left

## The owner's brief, verbatim

> **"we want to have a single chat box with everything inside it. when we were
> planning the chat box, this was the original plan. but somehow you made it all
> over."**

> **"use facebook business messenger as a guide on how to make this minimal and
> functional"**

And on seeing the prototype: **"do it."**

The design reference is **`06_THE_CHAT_BOX_PROTOTYPE.html`** in this zip.

## The defect it closes

The thread had become several stacked panels — a quotations card, a files panel,
a lock modal, a tools row — each competing for the same vertical space. On a
phone the conversation itself was crushed to **32px**. The thing the page exists
for had the least room on it.

## What shipped

### #5584 — the quote lives in the conversation ✅ MERGED
- The quote is a **message in the stream**, not a card beside it, with its line
  items visible.
- A **Counter-offer** control — implemented as a `Link` to `?compose=deal`, **not
  a callback**, because a server component cannot pass a function to a client one.
- Two **jump pills** appear when the quote scrolls off-screen or the reader is
  away from the bottom.
- The conversation keeps a **`min-h` floor** (it had been a fixed
  `h-[calc(100dvh-12rem)]`, which is what let it collapse).

### #5586 — one frame ⏳ IN FLIGHT AT HANDOFF
Both thread pages — the couple's and the supplier's — become a **single
Messenger-style frame**: one header, one scrolling column, one composer, and the
tools in a **tray** rather than stacked panels.

## ⚠ The height table is a TRAY-CLOSED table

Published earlier as if general. With a tool panel **open**:

| tray state | 320 | 360 | 390 | 1440 |
|---|---|---|---|---|
| deal menu open (126px) · couple | 224 | — | 265 | 345 |
| tool taller than the screen · supplier | **224** | **224** | **224** | **224** |

With a tall tool the list sits at **exactly its 224px floor at every width**; the
panel body caps at **55dvh** and scrolls inside itself (1424px of form in
311–494px); the composer's bottom edge stays inside the viewport while the column
scrolls. That is the design — but do not quote the wider numbers as if they hold
with a tool open.

## The floor is now a chain across three files

`page` renders the stream as the ChatBox **child** → the slot is `min-h-0 flex-1`
→ the `<ol>` carries `min-h-[Nrem] flex-1`.

🔑 **The guard must walk that chain.** The original guard anchored on *"the
`<div>` opening last before `<ChatMessageStream>`"* — pure source order — and in
the one-frame page the composer is a **prop**, written before the stream
**child**. So it read the declined-inquiry notice and failed against correct
code. This is the slid-window costume of green-shaped nothing, in reverse.

## What is still to build on top of it

**"Update this quote"** — see `00_START_HERE.md` step 2. Owner: *"they can do
updates and must be reaccepted."* It rides inside this frame, which is why it is
sequenced after #5586 and not before.

## Out of scope — deliberately

`actions.ts` files. There an absence **denies**, and failing closed is correct.
Do not apply the honest-read pattern to them.
