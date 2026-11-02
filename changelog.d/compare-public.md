## 2026-08-08 · feat(explore): the compare page stops dead-ending at Save

**What a person experiences.** You put two shops side by side to decide between
them. Until now the only thing you could do at that moment was save one — there
was no way to actually ask either of them anything, so the page ended exactly
where the decision was made. Each column now has a **"Ask about your date"**
button at the bottom that takes you straight to that shop's inquiry box.

**And it is there for someone who is not signed in.** This page needs no account
and no wedding of their own — anybody who follows a link to it lands on it. That
person is the one furthest from booking, so hiding the button from them is
hiding it from the only visitor it was built for. They press it, write their
message on the shop's page, and are taken to sign up so it can be sent. Owner
ruling, 2026-08-08.

A shop with no public address of its own shows a dash instead — there is nowhere
to send anyone. That is the only reason a column has no button.

**The trap I hit — a gate that would have hidden a working door.** The plan for
this change said to read each shop's contact email and hide the button when it
was blank, so we never point someone at a shop that cannot be reached. Reading
the destination changed the call: the shop page shows its own three "Inquire"
buttons, and both of its message boxes, **without ever looking at that field** —
only one sentence of explanatory text reads it. So the proposed gate would have
hidden a *working* way to get in touch from any approved shop that simply never
typed an address into that box, which is precisely the hiding the owner had just
ruled out. The button now depends on nothing but the shop having a public
address.

**The other trap — a second read can fail on its own.** Adding that check would
have meant a second question to the database. A failed question here comes back
looking exactly like an empty answer, so a broken read would have produced a
column with no button that is indistinguishable from a shop with nothing to
offer. This change asks the database nothing new at all. The one question the
page already asks fails closed: if it breaks, fewer than two shops survive and
the page sends you back to the marketplace rather than showing half a
comparison — so this button can never appear over data that failed to load.

**Colour.** The button is the deep gold that can carry a word (4.86:1). The
design spec said terracotta and the ordinary gold was tried before; ordinary gold
under a cream label measures 3.37:1 and is unreadable. Verified by deliberately
repainting it and watching the contrast check fail on this exact line.

Also added: a structural guard (`app/explore/compare/ask-about-your-date.test.ts`)
that fails if the button is removed, renamed, pointed elsewhere, hidden behind a
sign-in check or a contact-email check, paired with a fill it cannot be read
against, or backed by a new database read. Nothing in CI renders a page, so this
ruling had no natural detector — re-hiding the button would otherwise compile,
typecheck, pass every lint and look tidier in the diff. All eight of its
assertions were broken on purpose and confirmed to fire.

Not changed: the shop page keeps its own "Inquire" wording (that rename is owned
by a separate guard and is an owner copy decision), and no existing row, control
or destination on the compare table was touched.

**Flagged, deliberately not fixed here.** The "View full profile" link directly
above the new button is written in plain gold on cream — 3.37:1, under the
readability floor for text that small. It is a pre-existing defect, not one this
change introduced, and the same shade is the reason the button beside it uses the
deeper gold. The contrast check cannot see it (it judges text sitting on a solid
fill, and this text sits on the page). It belongs to the compare table's restyle
unit, which is a separate piece of work; the new button deliberately does not
copy that colour.

SPEC IMPACT: None — implements E7 of
`Design_Warm_Editorial_Archive_2026-08-08/FABLE_Public_Marketplace_Spec_2026-08-08.md`
(§ 2.E3 · § 3.7) with two documented deviations already recorded in that folder:
the fill follows `ACTION_COLOUR_OVERRIDE_2026-08-08.md` (deep gold, not
mulberry), and the CTA has no contact-email gate, per the owner's 2026-08-08
ruling that a signed-out stranger must never be shown a dead end.
