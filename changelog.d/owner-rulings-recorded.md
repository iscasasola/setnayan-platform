## 2026-08-15 · docs(editorial): the owner ruled — every kind of day stays eligible

Owner, verbatim: *"making it public will be the user's decision. this is already
the era where hanging out or meeting with friends are content that people view.
so yes."*

**No behaviour change — `EDITORIAL_EXCLUDED_EVENT_TYPES` already shipped EMPTY.**
What changed is that the module stopped claiming the question was open. Its
docblock still read **"⏭ OPEN OWNER DECISION"** hours after the ruling, which is
the exact stale-state failure this project keeps paying for: a decision recorded
in one place and contradicted in the place people actually read.

🔑 **THE KIND OF OCCASION IS NOT SETNAYAN'S QUESTION AT ALL.** Whether a day is
public belongs to the people whose day it is — `events.landing_page_visibility`
— not to a list of approved occasion types. My standing recommendation (allow
all, but never *solicit* the intimate kinds editorially) is **superseded**: the
owner declined to treat any kind as categorically un-publishable.

🛡 A test now asserts the set is **empty**, so excluding a kind must be a
deliberate act that also edits the test — never a quiet append. An entry there
says *"nobody may ever publish this kind of day, whatever they choose"*, a
stronger claim than anything the product currently makes. Mutation-proved:
`['hangout']` → RED.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-15 (all four rulings) ·
`STORIES_AND_EDITORIAL_INTEGRATION_2026-08-15.md` §7.
