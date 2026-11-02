## 2026-08-18 · fix(dashboard): put-away has a door, tells the truth after you press it, and updates

**All three found in one four-minute owner test**, and none of them by a machine.
Asked to press the new put-away button, the owner answered *"i cant find it."*

### 🚨 1 · Two live pages had no door

`/dashboard/[eventId]/details` (Personalization, which holds put-away) and
`/dashboard/[eventId]/hosts` were linked by exactly ONE component —
`app/_components/profile-menu.tsx` — and **that component is imported by
nothing.** It was superseded by the account switcher, which carries neither row.
Both pages were live, correct, tested, and reachable **only by typing the
address.**

🔑 **A LINK IN A COMPONENT NOBODY MOUNTS IS NOT A LINK.** This is the
gate-with-no-handle shape one level up: not a switch nobody can flip, but a PAGE
nobody can reach. It survived every check we have, because all of them ask
whether the route RENDERS — and it does.

⚠ **And the register said otherwise.** `lib/nav-registry-defaults.ts` still lists
`customer.profile-menu.hosts` and `customer.profile-menu.personalization` under a
`profile-menu` area that no longer ships. One file said the door was there, the
app disagreed, and nobody read both.

Both now sit in **the event's own list**, beside Schedule and Seat plan — not the
account menu, because that menu is about *you* and "put this celebration away" is
about the *event*. That is also simply where the owner looked.

### 🚨 2 · The after-message still carried the old promise — and it was mine

The pre-press copy was corrected THIS MORNING, because *"everything keeps
working"* stopped being true once put-away made the cameras and the guests' photo
wall go quiet. The half a person reads **after pressing** was left saying:

> *"Everything is still here — the photos, the guest list, the page your guests use."*

🔑 **A CORRECTION AT ONE SITE IS NOT A CORRECTION.** The rule is written down in
this repo and I broke it on the same card, the same day. It is the worse half to
get wrong: before pressing you are deciding; after pressing you are checking
whether to worry — and it told you nothing had stopped.

### 🚨 3 · The screen did not move until the page was reloaded by hand

The action saved correctly and the card kept rendering the un-pressed state.
`revalidatePath` marks the cache stale; it does not push fresh props into a
client component already on screen, and this card's entire state is a server
prop. **Pressing a button and seeing nothing happen is how somebody presses it
twice** — a silent success reads exactly like a dead button. `router.refresh()`
on success.

### 🛡 Guard

`reachable-without-typing-the-url.test.ts` asserts the rail links every page on a
must-have-a-door list, **and** that the component holding a link is actually
mounted — the assertion that would have caught the original defect, since a naive
"does any file reference this href?" check passes while the door does not exist.
Two mutations (remove the row; point it elsewhere), both measured, both red.

🪤 **The new guard ran ZERO TESTS AND EXITED GREEN on its first invocation** —
`npx tsx --test 'app/dashboard/[eventId]/…'` reads the brackets as a glob
character class, matches nothing, and reports `# tests 0 … # fail 0`. This repo
has that trap written down and it still cost a round trip. Run it from inside its
own directory.

SPEC IMPACT: None.
