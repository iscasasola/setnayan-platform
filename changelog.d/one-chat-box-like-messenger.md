## 2026-09-18 · feat(chat): one chat box — both thread pages become a single frame, Messenger-style

**What:** The couple's thread stacked SEVEN separate bordered cards down the column
(header tile · safety panel · pinned quote · "Inquiring about" row · the conversation ·
the call row · "+ Deal or meeting" · the composer). The conversation was one card among
the others and got whatever they left — **32px of visible height against 498px of
content** on a 390px phone (measured on production 2026-09-18). Owner's reference:
Facebook Business Messenger, "minimal and functional"; the approved layout is the
"One Chat Box" canvas of the same day.

Both thread pages now render ONE bordered frame (`app/_components/chat/chat-box.tsx`):

- **Header** — back chevron · initials · counterparty · one muted line (service · event
  date · guest count) · ⋮. The couple's tagline no longer prints in the header.
- **Notice** — ONE line. The couple's `ChatSafetyBanner` keeps its × (dismissal still
  persists in localStorage, as before) and gains a *Tips* toggle that opens the same four
  points in place. The supplier's `ChatPrivacyNotice` stays non-dismissible (iteration
  0019 § Gate lock) with a *More* toggle to its full locked copy. No copy was cut.
- **Chat · Decisions · Files** — the shipped `ThreadViewSwitch`, first tab renamed from
  "All" to "Chat"; its hint line hides below `sm`. The approved canvas drew six tabs
  (Chat · Quote · Payments · Files · Schedule · Details); Quote, Payments and Schedule are
  what **Decisions** already is on both sides (every card with where it stands NOW), and
  "Details" is a page, so it sits behind ⋮ on the supplier side (*Full customer profile*).
  Six tabs also overflow at 390px, which the coordinator asked us not to ship.
- **The conversation** — the only scroll region; `ChatMessageStream` gains a `flush`
  prop that drops the card chrome inside the frame (the other two mounts are unchanged).
  The row is bounded again (`h-[calc(100dvh-12rem)]`) so the composer pins and the list
  scrolls inside the frame, with a `min-h-[27rem]` floor under the row and the list's own
  `min-h-[14rem]` from #5584 — on a 320px phone the page scrolls instead of the frame
  clipping. Measured with a quote present (the real frame components server-rendered,
  the repo's Tailwind compiled against them, a real browser at each width): couple
  320 → 224px · 360 → 224px · 390 → 391px · 1440 → 453px; supplier 224 · 224 · 357 · 443.
  Before #5584 the same stack measured 32px at every width (the harness reproduces
  production's number exactly); on `origin/main` today the couple's list is unbounded
  (client = scroll = 1079px at 390) so the page scrolls 1092px and a thread opens at its
  oldest message with the composer a screen below.
- **Composer row** — attach · message · 🧾 deal · 📞 call · send. `ThreadCallLauncher`
  and `NegotiationComposerMenu` stop being cards and become closed `<details>` panels in
  a tray below the composer, opened by two `RevealToolButton`s through the SAME
  `revealThreadTool` the supplier's rail has used since 2026-09-08. The icons step aside
  while a draft is being written (320px: four 44px controls leave the box ~60px). The
  panel registry (`lib/chat-box-tools.ts`) is DERIVED from `VENDOR_THREAD_TOOLS`, and
  throws on a key the list does not know.
- **Supplier side** — the nine tool panels move from above the stream into the tray;
  the contextual cards (day-prep CTA, attribution, collab, guest-count proposals, live
  payment confirms) become a capped, `empty:hidden` pinned band under the notice that
  carries the `pending-payments` anchor.

**Fixed on the way:** on the supplier side `?compose=deal` (the Counter-offer link
#5584 added to every quote card) seeded the amendment builder inside a CLOSED
`<details>`, so the link landed on a page that looked unchanged. `ThreadToolPanel`
takes `open` and both pages set it from `?compose=deal` on the server.

**Moved:** `reveal-thread-tool.tsx` → `app/_components/chat/` (both pages mount
`ThreadToolHashReveal`). `scripts/port-control-baseline.json` regenerated: the supplier
route drops `HTMLDetailsElement` / `HTMLElement` (TS generics in the moved file that the
extractor reads as blocks — not widgets); both routes GAIN `ChatBox`, `RevealToolButton`,
`ThreadToolPanel`; nothing else is lost. The couple's page leaves
`page-masthead-baseline.json` (it no longer hand-rolls a `<header>` with `.sn-eye`).

**Guards:** `lib/one-chat-box-like-messenger.test.ts` (registry executed; source read
comment-free and counted). `a-quote-card-does-not-crush-the-conversation.test.ts`'s
column test evolves from "the column must grow" to "a bounded row must carry a ≥26rem
floor on the same className, on both pages" — the property moved to where it is
enforced; the bare fixed shape stays forbidden.

SPEC IMPACT: None — implements the owner-approved 2026-09-18 "One Chat Box" layout on top
of the 2026-09-09 chat prototype's placement rules; no locked decision changes.
