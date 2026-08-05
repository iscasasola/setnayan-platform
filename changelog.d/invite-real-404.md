## 2026-08-05 · fix(guest-site): a link to no event 404s instead of blaming the link

**SPEC IMPACT:** None.

**Found by walking the live site, not by any test.**
`/this-wedding-does-not-exist/invite` answered **HTTP 200** with the stale-token
screen — telling someone who mistyped an address that their invitation link had
expired and to ask for a fresh one. They would go back to whoever sent it and
ask them to re-send a link that was never broken.

It is also a soft-404: an indexable 200 on every junk `/anything/invite` URL —
the same bug `04c03063d` fixed at the route root, and the same one the 3D venue
had until #4128.

A slug that matches no event now `notFound()`s. The stale-token screen stays for
the case it was written for — the event **exists** and its join token is missing,
revoked or expired — and the guard asserts it survives, because deleting it
would break a real path while making this test pass.

This is the third face of one rule this week: **"there is nothing here" and
"something went wrong" and "you are not allowed" are three different sentences,
and a guest must be told which one they are in.**
