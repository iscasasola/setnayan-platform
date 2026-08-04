## 2026-07-30 · docs(papic): the copy sweep — the help center stops promising five free cameras, and the features page stops promising a native app

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-E**. Every remaining surface still describing the retired Papic, plus the two help articles the two-type model needs and never had.

### Help center — [`lib/help.ts`](apps/web/lib/help.ts)

- **`turn-on-papic`** — *"Your first **5 guest cameras** are free to try. Pick how many **crew seats** you want, then share each **seat's** link…"*. The spec called this the most wrong sentence in the help center and it was: there is no 5-camera free tier, no seat count to pick, and no seat. Rewritten around what actually happens — Papic is already on, every wedding starts with a free shared pool **plus** one free camera of its own, guests shoot by scanning the event QR with no limit on how many phones join, and a single person can be handed a camera whose balance nobody else can spend.
- **`what-is-papic`** (papic topic) — named the two products for the first time, and dropped *"— if you add it — every guest can snap photos too"*: guest capture is not an add-on purchase any more, the free pool is armed on every event at creation.
- **`papic-crew-how-to-shoot`** — "seat link" → "camera link", "claim your seat" → "claim it", and it now mentions the camera's own balance and that the couple can top it up (the crew member's most likely question, previously unanswered).
- **NEW · `papic-pool-vs-papic-one`** — *"Papic Pool or Papic One — which one do I want?"* Answers it in the terms a couple actually decides in: the Pool covers the room but everyone draws from one purse, so a few enthusiastic guests can spend a lot of it; a One covers a person whose balance is safe no matter how busy the crowd gets. Rule of thumb stated plainly.
- **NEW · `how-papic-shots-work`** — how the currency works and how to add more, including the thing that confuses people most: photos and clips come out of **one** purse, so shooting clips leaves fewer photos — which is why we never promise an exact "N photos + M clips". Also states that top-ups **stack** rather than replace, and that guests can top up themselves.

**The shot weights are DERIVED, not typed.** The new article interpolates `papicPointCurrencyTerms()`, which builds its two phrases from `PAPIC_POINTS_PER_PHOTO` / `PAPIC_POINTS_PER_CLIP` on the capture path itself. The clip weight moved 7 → 8 on 2026-07-29 — prose that had typed the number would have gone quietly wrong that day, on the one surface a confused couple reads. `papic-tier-copy` is pure and client-safe, so the import costs nothing (and `help.ts` has no client consumers anyway).

### Marketing + demo surfaces

- **[`features/_sections/_DayOfApparatus.tsx`](apps/web/app/features/_sections/_DayOfApparatus.tsx)** — *"**Native iOS/Android app** for friends and family"* contradicted the no-install promise every other Papic surface makes, including the card two sections above it. Replaced in **both** the EN and Taglish twins (they drift independently, so both were edited in one pass) with a one-line pitch of the two types, opening on "both in the browser — no app to install".
- **[`home/papic-demo-overlay.tsx`](apps/web/app/_components/home/papic-demo-overlay.tsx)** — *"The real Papic is **unlimited, every guest, all day**"* was three retired claims in six words. Now: no limit on how many phones shoot (true — Pool cameras are unbounded), and every wedding starts with free shots (true — the grant is armed at event creation). What's metered is shots, and the line no longer implies otherwise.
- **[`app-store/studio-card-demo.tsx`](apps/web/app/_components/app-store/studio-card-demo.tsx)** — the demo camera chrome read `PAPIC · SEAT 2` with a `3 / 8` counter. Both retired: there are no seats, and there has never been a per-camera cap of 8 anything. A demo tile must not invent a limit the product doesn't have.
- **[`[slug]/_components/photo-moments-widget.tsx`](apps/web/app/[slug]/_components/photo-moments-widget.tsx)** — the guest-facing badge said *"Our paparazzo"*, singular, implying one appointed shooter. Now plural.
- **[`[slug]/_components/editorial/data.ts`](apps/web/app/[slug]/_components/editorial/data.ts)** — six `5-second clip` comments updated to 10-second. The cap moved on 2026-07-22 (owner-reversed) and these were the last places still documenting the old one, which matters because they sit next to the code that selects clips for the editorial timeline.

**Not changed:** the general-FAQ `what-is-papic` (a different topic, already accurate and already points at `setnayan.com/pricing` rather than spelling a price) and the `PAPIC_SEATS: 'Papic'` label-map key — that one is a *legacy row's* display label, deliberately kept so a pre-retirement order still renders a clean "Powered by", and it was already documented as such in PR-C.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK (1,938 files, 0 retired strings) · **`test:unit` 5,428/5,428 pass**. No local `npm run build` (7 GB heap → SIGTERM 143).

SPEC IMPACT: Applied to the corpus — `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-E closed + §2.1 build log, and `DECISION_LOG.md`. No price, SKU or schema change; prices in help prose continue to point at `setnayan.com/pricing` rather than being spelled.
