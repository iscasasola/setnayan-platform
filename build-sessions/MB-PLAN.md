# Mood Board Build-Out — MB0 … MB14

Planned 2026-09-03. One session per file, one branch per session, one PR, auto-merge armed,
worktree pruned on merge. Same pattern as `BA1–BA8`, `EH1–EH6`, `L1–L15`, `LS1–LS7`.

## Ground rules that shaped this plan

1. **Honesty to couples outranks new features.** That priority held all day and it holds here —
   MB1 (the 3D room silently ignoring saved design) sits ahead of everything shiny.
2. **Migrations land before feature code**, inside every schema-bearing session.
3. **Never derive a price from code or from a document.** Read `platform_retail_catalog_v2`.
   2026-09-03 produced FIVE superseded price rows. The surviving facts are:
   - one pack: **50 credits / ₱1,000** — grep `"ONE RENDER PACK ONLY"` in `DECISION_LOG.md`
   - **1 credit per part / 5 credits whole look** — grep `"20 RENDERABLE PARTS"`
   A careless grep rebuilds ₱15/photo or the ₱60/4 pack. Those are corpses. Name them as corpses.
4. **An anchor is a string, never a number.** Every brief cites greppable symbols.

## Owner decisions that gate the critical path

| # | Decision | Gates | Recommendation |
|---|---|---|---|
| 1 | `color-space.ts` docblock amendment | **MB4 → MB5, MB13** | **Amend, don't re-derive.** The docblock locks CIELAB as "the one perceptual colour space"; the verified engine is OKLCH. Re-deriving in CIELAB discards the verification to satisfy a comment. Amend to state the boundary: CIELAB for naming + ΔE audits, OKLCH for the palette-style engine only, one importer each, guard pinning that no third space appears. |
| 2 | Render cache-key coarseness (~2,000 buckets) | MB9 only | Approve as specced. MB8 ships without the cache either way — don't let this block the paid path. |
| 3 | Does part-finalization inherit "a booking outranks any marker"? | MB12 | **No.** Auto-finalizing a design part the vendor never reviewed fabricates the very agreement the handshake exists to capture. |
| 4 | R2 credentials | MB14 only | Cheap to hand over whenever. |
| 5 | **Gemini API key in Vercel** | **MB8 — the first peso** | Not previously on the blocker list. Without it the pipeline sends **nothing, silently** — the exact `RESEND_API_KEY` failure shape. Provision before MB8 merges. |
| 6 | Community gallery route + Terms amendment | — | See "What we are not building". |
| 7 | **Do existing 3D rooms opt in to the new derivation, or stay as they are permanently?** | MB15 | Opt-in, with a clear *"your room will look different"* prompt. But a couple mid-planning may reasonably want the better derivation without being asked — this is a live-customer question, not an engineering one. Needed only when MB15 starts, i.e. last. |

**The two worth extracting today: #1 and #5.**

## Sequence

```
MB0 → MB1 → MB2 → MB3 → [decision 1] → MB4 → MB5 → MB6 ┐
                                                        ├→ MB7 → MB8 → [decision 2] → MB9
MB0 ─────────────→ MB10 → MB11  (parallel, second agent) ┘
MB5 + MB10 + [decision 3] → MB12
MB13, MB14 float
MB1 + MB5 + MB6 + MB12 → MB15   ← LAST. The two surfaces meet.
```

~15–17 build days serial · ~11–12 with the gallery arc parallelised.

**MB15 closes the loop the owner opened on day one** — *"there are values that the 3D Plan needs
from it."* MB1 repairs what the room already ignores; MB15 connects what the redesigned board
newly knows. They are deliberately separate: MB1 is dishonest on live events **today**, MB15 is
impossible until the board exists. Do not merge them.

| ID | Session | Model / effort | Size |
|---|---|---|---|
| MB0 | Land the boat | Sonnet · high | ½ day |
| MB1 | The room shows what the couple chose | **Opus · high** | 1 day |
| MB2 | Make-it-real schema: ledger, renders, one SKU | **Opus · high** | 1 day |
| MB3 | Port the shell + 00 and 01 | Sonnet · high | 1½ days |
| MB4 | The palette-style engine lands as a real lib | **Opus · high** | 1 day |
| MB5 | Port 02: Palette | Sonnet · high | 1 day |
| MB6 | Port 03: Reception | Sonnet · high | 1 day |
| MB7 | Port 04: render surface, free tier first | Sonnet · high | 1 day |
| MB8 | The paid render pipeline | **Opus · high** | 1½ days |
| MB9 | The render cache | **Opus · high** | ½ day |
| MB10 | Supplier gallery chain + picker | **Opus · high** | 1 day |
| MB11 | Unlock vendor uploads, safely, in one move | **Opus · high** | 1 day |
| MB12 | Per-part finalization handshake | **Opus · high** | 1½ days |
| MB13 | OKLCH progressive recommender | Sonnet · high | ½ day |
| MB14 | Decor-image pilot goes live | Sonnet · medium | ½ day |
| **MB15** | **The mood board reaches the 3D Plan** | **Opus · high** | 1½ days |

Opus where a mistake is expensive and hard to see: schema, money, two-party state machines,
public buckets, and the colour engine whose invariants die in translation. Sonnet where the
prototype is the authoritative reference and the job is faithful translation — still at high
effort, because "translate, don't reinterpret" is itself easy to get wrong.

## What we are not building

- **The community theme gallery.** The supplier-gallery decision already makes the argument
  against it: couples' Pinterest saves are photographers' work nobody in the chain owns, while a
  supplier's own portfolio is content they own and *want* discovered — safe to show publicly by
  construction. MB10 + MB11 deliver the public-gallery outcome through the clean channel. Park it
  behind the Terms amendment indefinitely; if couple-to-couple sharing is still wanted later,
  scope it fresh against what MB10/MB11 proved.
- **MB13 is the designated slip** if the arc runs long. 02 works without it and nothing depends
  on it. Everything else earns its slot.

## Verification every session owes

Run unit tests from `apps/web` — the repo root breaks every `@/…` import, including the repo's
own guards. `pnpm lint` does **not** run the ~27 blocking guard scripts; they are separate CI steps.

- `pnpm exec tsc --noEmit` from `apps/web`, in a worktree that has `node_modules`
- any migration → full `*.db.test.ts` replay **including** `ugat-schema-claims` and
  `ugat-concept-coverage`; allocate the prefix with `pnpm migration:new`, never hand-typed
- touching `events` columns → `node apps/web/scripts/lint-events-column-grants.mjs`
- new routes or controls → `node apps/web/scripts/port-controls.mjs` against the baseline
- **every new guard gets sabotage-tested** — break the thing it watches, confirm red, restore.
  A guard that has never gone red is a guard nobody has tested.
