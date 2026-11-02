## 2026-08-05 · fix(couple-dashboard): "Live" now means a guest can actually open the page

**SPEC IMPACT:** None (derived status copy; no schema, no visibility semantics changed).

A couple prints this link on invitations. Two surfaces claimed the site was live
on evidence that had nothing to do with whether anyone could open it.

- **The website home showed a green tick and "Live — this link is yours" as soon
  as `event.slug` was non-null.** A slug is a NAME. Every event gets one at
  creation, months before launch, and a page set to Private has one too.
- **The privacy page computed `launched = std_launched_at || visibility ===
  'public'`.** So a couple who launched their Save-the-Date and later chose
  Private saw *"Your page is live — anyone with your link can view your page"*
  sitting directly above a radio button reading **Private**. Two claims on one
  screen, and the confident one was wrong: guests opening the link were getting
  the locked screen.

Both now derive from `resolveSiteReachability` in `lib/launch-save-the-date.ts`,
built on the same `resolveEffectiveVisibility` the guest page renders from — so
the couple's screen and the guest's screen cannot disagree about one event.

`launchedButHidden` is the case worth naming: saying only "not live" would be
true and useless, sending them to look for a launch button they already pressed.
The screen now says the Private setting is what is overriding it.

**Editor preview.** Four of its five tabs render the page as a STRANGER sees it;
only the RSVP'd tab simulates a guest, and it was the only one that said so, so
the silence on the others read as "this is just your page". Every tab now states
whose view it is. That is not a substitute for the view itself — the `?as=`
machinery covers one phase, and extending it to the Invitation and day-of tabs
is still open — it is a substitute for the wrong impression while it is.
