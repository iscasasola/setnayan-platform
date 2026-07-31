## 2026-07-31 · feat(home): split Spaces in two, give People a real doorway, put a scene on the event card

Three prototype features from `06_Prototypes/User_Home_REDESIGN_2026-07-30.html` that
never shipped. All three live in `apps/web/app/dashboard/(launcher)/page.tsx`, which is
why they are one change.

**1 · Spaces split in two (owner decision: "split it in two").** One tile was carrying two
opposite stances — a shop you *operate* and a vendor you *saved* — plus Samahan, which is
neither. It is now:

- **"Yours to run"** — the vendor shop(s), Admin HQ, and the Creator's Lab (Your Story /
  Become a Storyteller). Shop + HQ rows stay capability-gated; the Creator row renders for
  everyone, so a plain couple never gets an empty heading.
- **"Vendors you saved"** — the shortlist doorway into `/dashboard/library?tab=vendors`,
  which until now had **no link anywhere on the home** (it existed only inside the Memories
  Hub's own tab strip). Deliberately prints **no count**: the tab filters saved vendors
  through `lib/vendor-favorite-gate`, so a raw count read here could disagree with the list
  it opens — a number that can lie is worse than no number.

**2 · A real People block.** People had a ⌘K entry and a phone pill target and nothing
rendered — a palette entry is not a doorway. The new tile is built ONLY from sources that
are real for the account:

- **Samahan · Communities** — live for everyone, **moved out of Spaces into People**. This
  is the model `/dashboard/people` itself states ("your connections, your alaga, and your
  samahan groups"): a samahan is who you gather with, not a console you run. Same rows,
  same cap, same "+ Create a Samahan" door — no control was removed.
- **Alaga** — queried only when `NEXT_PUBLIC_DEPENDENT_PEOPLE` is on **and** the
  `dependent_minor_profiles` privacy control is Active, and rendered only with real rows.
- **Connections** — queried only when `NEXT_PUBLIC_PEOPLE_CONNECTIONS` is on, rendered only
  with ≥1 confirmed edge.

Both flags are OFF in production, so **in prod today the People tile is exactly its Samahan
group** — the small honest version. A failed/denied count stays `null` and renders no row
(an RLS denial and an empty table are the same value; "0" is never asserted from a read we
could not prove was permitted). The "Everyone you gather" link to `/dashboard/people`
appears **only when one of those flags is on**, because with both off that route
short-circuits to a non-interactive "coming soon" preview — and a link to a preview is a
door to nothing.

Consequence: the phone pill's capability-gated Spaces slot no longer points at
`/dashboard/samahan` (now a People destination); it lands on the console the account
actually holds — `/vendor-dashboard` or `/admin`, the same targets the "Yours to run" tile
renders.

**3 · Richer event cards ("let them get to imagine what the events are").** The desktop
card's 64px paper stripe is now a 128/144px **scene**: the event type's own hero — the
admin `event_type_vocab.hero_photo_url` → `/event-types/<key>.webp` precedence the
create-event picker already uses — scrimmed, with the type badge, the monogram overhanging
the band, and the event's **name + place** set on it. A type with no asset at all (e.g.
`date`, `hangout`) lands on the deterministic branded gradient
`eventTypePlaceholderGradient(key)`, never another type's photo; the gradient is painted
*under* the photo so a 404 reveals it with no flash and no layout shift. One cached vocab
read (`getEventTypeVocab`) serves every card. Hrefs, date-descending ordering, the
"Show all" toggle and the whole mobile hero/chip composition are untouched.

Also: `heart` added to the ⌘K icon roster and a "Saved vendors" jump item added, so the new
doorway is reachable from the palette too.

SPEC IMPACT: None. No schema, no RLS, no pricing, no entitlement. Every href is a route the
app already renders; every value shown is an aggregate the page already computes or a
flag-gated real count. One finding for the owner is reported in the PR rather than fixed
here: `/dashboard/people`'s `PeoplePreview` early return runs *before*
`<SamahanPeopleSection />`, so that section — whose own comment says "Not flag-gated —
samahan is live product" — is unreachable in production. Making it reachable widens what
one member can see of another (second-degree names via the admin client), so it is an owner
/ DPO call, not a drive-by fix.
