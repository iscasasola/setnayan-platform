## 2026-09-18 · fix(papic): the free credit pool is promised once, not on every event

The free Papic pool is claimed **once per ACCOUNT** — `papic_claim_free_pool`
inserts `ON CONFLICT (user_id) DO NOTHING`, so a couple's second celebration
gets a **1-credit floor**, which exists so the pool reads as metered and is not
a perk. Six live surfaces said otherwise.

**The guard for this already existed and was correct.**
`the-free-credit-promise-is-true.test.ts` asserts *"the page may not say
every"* — and passed, because its surface list is four `/papic` page files. A
correct guard facing the wrong files.

Corrected (all six):

| surface | said |
|---|---|
| `lib/help.ts` ×3 | "Every wedding starts with 50 credits free" · "every wedding starts with a free pool of credits" · same again under shots |
| `lib/llms-txt.ts` ×2 | "50 credits free on every event" · "50 free on every event" |
| `app/_components/home/papic-demo-overlay.tsx` | "every wedding starts with free credits" — **the home page** |
| `app/dashboard/[eventId]/_components/papic-ready-nudge.tsx` | "Every celebration starts with a shared pool of credits" — **the couple's dashboard** |
| `app/admin/pricing/_components/papic-rest-editor.tsx` | "Free credits on every event" |

**The sweep found three. The tree-wide guard found six.** The three I would have
missed are the two highest-traffic ones and an admin label that shapes the
owner's own understanding of what the platform grants.

**`lib/the-free-pool-is-not-on-every-event.test.ts`** sweeps `app/` + `lib/` and
is **deliberately narrow**: the wide version convicted eight innocent lines.
"Free on every event" is not the falsehood — *a free CREDIT POOL on every event*
is. One free **camera** per event is owner-locked and true (2026-07-29), as are
Kwento and Live Wall being free per event. The subject is what makes the claim
false, so the subject is what it matches on. It carries **two floors**: every
true "every event" sentence must still pass, and each of the four shipped
strings must still be caught.

Where the camera and the pool appear together the copy now separates them
rather than dropping either — the camera IS every event; the pool is the first
celebration.

SPEC IMPACT: None — this makes the copy agree with `papic_claim_free_pool`,
already the arbiter.
