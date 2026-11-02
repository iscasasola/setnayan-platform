## 2026-08-06 · docs(claude): commit the "Cloudflare is storage only" correction — it was never in git

`CLAUDE.md` is loaded into every Claude Code session as standing instructions.
This nine-line block existed **only as an uncommitted local edit** on the owner's
machine, so it was absent from `origin/main`, from every worktree, and from every
CI run — including all seven worktrees created today.

**🚨 THIS IS THE SECOND TIME.** RULE 0 — the owner-locked "find it before you
build it" rule — lived the same way and was fixed in #4067. The lesson did not
generalise: an uncommitted edit to the auto-loaded instructions **looks fully in
force from inside the session that made it**, and invisible everywhere else.

What the block records: `setnayan.com` is a **GoDaddy** zone. Cloudflare holds
object storage only — no traffic is proxied through it, and its Domains list is
empty. So every "free Cloudflare feature" that operates on proxied traffic (CSAM
Scanning Tool, WAF, Bot Management, cache rules) is **unavailable** without
migrating DNS, which is real infrastructure work and not worth doing for one
feature. Storing files with a vendor is not routing traffic through them —
assuming otherwise sent the owner into that dashboard twice (2026-08-04/05)
looking for a page that could never exist.

Found while investigating why the home-directory protection merged on 2026-08-06
was not active locally: the owner's checkout is 294 commits behind, and these
uncommitted edits were part of what blocked the update.

SPEC IMPACT: None — repo instructions only.
