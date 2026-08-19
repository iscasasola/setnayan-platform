## 2026-08-19 · fix(nav): the People row looked like a section heading

**SPEC IMPACT:** None.

The owner read his own sidebar back to me as *"my home … with my events, alaala,
people"* and then, describing the same rail, put **Your Story** *inside* a
**People** group. That is exactly what it looks like — and it is wrong.

**The People row rendered its icon slot as the literal word "People", in a class
that does not exist.** `.fd-icon` has **no rule anywhere** in `front-door.css` —
only `.fd-icon-caption` does. Every sibling row is `fd-gi` (a 20px glyph slot)
plus `fd-label-text`; this one had neither, so it came out as unstyled body text
at heading size with no visible label of its own.

**Consequence:** the connections page — alaga, samahan, ninong/ninang, everyone
you gather — was reachable **only by clicking something that does not look
clickable**. The owner formed his mental model of the whole sidebar around it.

Now it matches its siblings: a glyph, a label, a caption.

🔑 **A CLASS THAT DOES NOT EXIST FAILS SILENTLY.** Nothing errors, nothing logs,
the element renders — just with none of the styling that makes it a row. Same
family as the rest of this week: **the only symptom is how it looks**, and the
person who notices is the one forming the wrong idea of the product.

⏭ **NAMED, NOT FIXED:** this row still cannot be renamed from admin. Its own
comment says why — there is no `customer.account.people` slot in the nav
registry, and `slotLabel` fails open on a miss, so passing a key that does not
exist "would render correctly forever while quietly never being renameable."
Adding the slot is a separate change; the comment stays until someone does it.

Verified: `tsc` clean (`--version` first) · 836 app tests green.
