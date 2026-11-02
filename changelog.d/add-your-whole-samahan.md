## 2026-08-25 · feat(guests): your whole samahan, in one go — and the premise that turned out half stale

**Measured before building, and the measurement changed the build.** The samahan register says
*"you cannot invite a whole samahan to an event — today a barkada and a guest list are strangers,
you retype every name."* Against `origin/main` that is **half false**: `getPeopleYouCanInvite` has
carried a `samahan` source since 2026-08-21, second-degree members included, so a barkada already
reaches the guest-list picker and **nobody retypes anything**. What was actually missing is the
group — twelve taps for twelve friends.

So this is the smaller fix, not the build the register describes:

- **A chip per samahan** at the top of the people sheet, derived from the rows themselves (the
  sheet cannot know a host's group names in advance). Tapping one filters to its members; tapping
  it again clears.
- **"Choose all N shown"** — one control that takes everyone the current search is showing, and
  lets go of them again. It never touches somebody already on the guest list, and never disturbs a
  pick that is not currently shown.
- The match rule and the choose-all rule moved into the pure core
  (`matchesInvitableQuery`, `chooseAllShown`) so the sheet holds no second copy: a chip works by
  matching the "from" line, and a drifted copy would quietly stop finding its own members.

🔑 **The group is a FILTER, not a stored link.** `guest_groups` has no `source_community_id` —
verified absent in the migrations and in production — and this PR does not add one. A wedding list
that changed whenever somebody joined or left a group chat is not a list the couple owns; these
land as ordinary guests from that second on. That also means the snapshot-vs-live fan-out question
that stalled this item never has to be answered.

Nothing new inserts: every pick still goes through `quickAddGuest`, so the names check, the side
check, the offered-role set, the post-finalize lock and the partial-success reporting are
unchanged. Seven mutations, each measured before → after, all red.

SPEC IMPACT: `WHATS_NEXT_Samahan_2026-08-24.md` § 2d is corrected in the corpus — its premise
("you retype every name") was stale by four days.
