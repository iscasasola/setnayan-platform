## 2026-08-25 · fix(samahan): a Setnayan admin could post into a private samahan, and two reads went silent without saying so

Three findings from an adversarial audit of the same day's own merged work. The audit's five
finders ran; **every skeptic died on a session limit**, so each finding below was re-verified by
hand against `origin/main` before anything was changed.

🚨 **THE STORY ROUTE'S MEMBERSHIP GATE ASKED THE WRONG QUESTION — and its comment said it was
airtight.** It gated on whether the caller could READ the community row, claiming "RLS hides the
community row from non-members, so an empty read IS the refusal". The policy is
`USING (community_id IN (SELECT current_community_ids()) OR is_admin())` — widened so Setnayan
staff can support a group. **RLS is a floor, not a scope.** So an admin who was never in a private
barkada could post a three-second clip into it and, since this morning's fan-out, ring every member
with a notice saying they "added to" that samahan. Production's admin is the owner's own account,
so it was reachable, not theoretical. Usapan never had the hole — a message goes through the
caller's own session and its INSERT policy demands real membership; a story is written with the
service-role client, so the app-side gate IS the whole fence. The gate now asks a **fact** — is
there a membership row for this caller — with the admin client, precisely so no policy can widen
the answer.

**TWO READS IN THE FAN-OUT DISCARDED THEIR ERROR** three lines above one that checks its error
precisely so it does not. Neither can fail toward ringing — you cannot tell a roster you were
unable to enumerate, and you must not announce into a samahan whose closed-state you could not
read — so both fail SILENT, which is the outcome the file exists to prevent. Both now check and
**log**, and the header says which reads hold which posture instead of claiming one for all three.

🪤 **AND A TEST OF MINE FROM THIS MORNING COULD NOT FAIL.** "A message notice carries no copy of
the message" built a long string, never passed it to anything, and asserted the output did not
contain it — the function has no parameter that could carry a message. Three green assertions
guarding nothing. It now asserts the SHAPE that actually keeps the words out: the copy function's
arity, the call's argument count, and that both call sites hand the fan-out exactly which samahan,
who acted, and what kind. 🪤 Its first cut then **cried wolf** on `kind: 'message'` — a word ban
where a shape check belonged.

Four mutations, each measured before → after, all red.

SPEC IMPACT: None.
