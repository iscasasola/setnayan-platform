## 2026-09-15 · fix(story): a guest column is signed with its author's whole name

Owner: *"fix the 36 surfaces that cant print full name."*

The duplicated-rule guard produced that list when `ENTOURAGE_COLUMNS` named ten
columns: **39 read sites, 36 of which select a guest's name without selecting all
five of its parts.** This is the first of them, and the triage matters more than
the diff.

### What this PR changes

The **guest-column byline** on the couple's story page. A guest writes a column;
their name is published under their own words — the same class of thing as the
entourage. It was composing the name **by hand**:

```
display_name ?? [first_name, last_name].filter(Boolean).join(' ')
```

a private copy of `guestFullName`'s rule, **which is exactly why it never learned
about the three parts added on 2026-09-10**. A column by *Atty. Cherry Liez O.
Rafal-Roble* was signed *"Cherry Rafal-Roble"*.

Now the read asks for the five parts and the byline delegates. One place knows
the printed order of a name; everywhere else asks it.

### ⛔ What this PR deliberately does NOT change — the triage

**"Fix the 36" is three jobs, and only one is safe to do mechanically.**

- **9 sites read a FIRST NAME ONLY.** They are greetings — *"Hi Ana"*. Making
  them "full-name capable" would produce *"Hi Atty. Ana Reyes"*. **They are
  correct as they stand**; they are not a gap.
- **Several are not a formal-name context at all**: the seat pass listing your
  tablemates, a plus-one lookup, the check-in desk. Each is a judgement about
  what that surface should print, not a missing column.
- ⚠ **One is the public API** (`/api/v1/events/[eventId]/guests`). Widening a
  select there changes **what an API response contains** — a disclosure change
  wearing a formatting change's clothes. It must not ride along in a name fix.

🔑 **The guard handed over a map, not a bug list.** Treating all 36 as one sweep
would have put a title on a seat card, a title in a greeting, and new fields in a
public API response — three regressions in the name of one fix.

### Verification

- `TSC_EXIT=0` · `DUP_EXIT=0` — the widened read **removes** facts from the
  duplicated-rule baseline rather than adding any (101 omissions here, down from
  108 on this branch's base)
- `UNIT_EXIT=0` — **15,693 tests, 0 failures**
- Under the machine's shared heavy-lock

SPEC IMPACT: None — the columns and the helper already existed.
