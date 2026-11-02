## 2026-08-18 · feat(auth): a password already in a public breach list is refused

Owner ruling 2026-08-18 (*"create a way"*), answering the open question of what to do about
accounts protected by a password that is already public.

**What a person experiences:** choosing a password that has appeared in a known data breach is
refused with a plain sentence, on all three screens where somebody sets one — signing up, an
invited guest setting their first password, and resetting a forgotten one. Every other password is
accepted exactly as before.

**The password never leaves this process.** Only the first five characters of its hash are sent;
the answer comes back as a list of tens of thousands of candidates and the comparison happens
locally. A test asserts the request path contains neither the password, nor the full hash, nor the
hash's remainder.

⚖ **It FAILS OPEN, deliberately.** If the breach service is slow or down, the password is allowed
through. A breached password is a risk; refusing every signup because a third party is unreachable
is a certainty. The result distinguishes *"checked and clean"* from *"could not check"*, so nobody
is told a lie about what happened.

🔑 **A rejected query is not a thrown error, in its third costume here.** A non-ok response body
contains no hash suffixes, so a naive reader concludes *"not breached"*. It must conclude *"did not
check"* — asserted by its own test, mutation-proved.

🔑 **A check wired into one of three doors is not wired in.** Signup is the obvious one; the
invited guest and the password reset are the two that get forgotten. A test reads all three files
and fails if any sets a password without checking it.

🪤 **The reset screen prints its error parameter verbatim**, so it is handed a full sentence rather
than a code — otherwise a person would have read the literal words `password_leaked`.

🪤 **A substring check over a string you do not fully control will find something you did not put
there.** The first cut of the privacy test asserted the request URL does not contain the word
`password` — and failed, because the hostname is `pwnedpasswords.com`. The test was right to fail
and wrong about why. It now asserts on the path.

🛡 Four mutations, each measured by occurrence count before → after, all RED: a 503 read as an
answer (1→0) · the reset door stops checking (2→0) · the signup refusal copy removed (1→0) · the
five-character prefix widened to the whole hash (2→1). ⚠ A fifth mutation was written against a
line that did not exist (count 0→0) and passed — its green meant nothing, and it was re-run
against the real line.

SPEC IMPACT: None. No price, SKU, schema or locked decision changes. No migration.
