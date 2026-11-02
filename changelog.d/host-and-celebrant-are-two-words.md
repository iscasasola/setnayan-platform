## 2026-08-27 · fix(words): a host and a celebrant are two different people

Owner ruling, verbatim: *"each event can be set to a single host or multiple
host. depending on the type of event. yes, there can be multiple hosts for every
event, but the one celebratiing is the celebrant that can be single, couple, or
multiple people."*

`event_type_profiles.terminology.organizer_noun` had been doing both jobs since
the profiles were seeded. `celebrant` / `graduate` / `couple` name whoever is
HONOURED; `host` / `organizer` / `family` name whoever RUNS it. For a wedding
they are the same two people, which is why it went unfelt — and prod is
weddings, so the wedding arm is the only arm anyone has ever seen.

**Two words now.** `host_noun` and `celebrant_noun`, plus `celebrant_shape`
(`single` | `couple` | `multiple`). Both nouns fall back through the row's OWN
organiser noun, so every row seeded before today reads exactly as it did.

**Seven sentences stop naming nobody.** The 2026-08-18 ruling had six admin
sentences DROP the person rather than print "The celebrant is still arranging
the venue layout" at a seven-year-old's birthday. That was the right call with
one word available. With two, they name the host — which is what they were
always trying to do. That workaround is retired, not contradicted.

**Hosts get no column, and that is the point.** How many hosts an event has is
already stored: it is who holds a host's key to it. A second copy of a fact the
database already holds is the shape this repo keeps paying for. The CELEBRANT's
shape cannot be derived from anything we hold — `honoree_label` is one free-text
first name and cannot tell twins from an only child — so that is the one part
written down, as `events.celebrant_shape` (NULL = the type's own shape, which is
every row today, so there is no backfill and nothing reads differently on
apply). Its control sits on Personalization, and is offered ONLY where the
answer could change a word: 'couple' and 'family' are collective and no shape
pluralises them, so a wedding and a wake are never asked.

**Byte-identity is asserted in both directions**, under all three shapes, for
the wedding and for each of the five seeded nouns.

SPEC IMPACT: `DECISION_LOG.md` — 2026-08-27 row recording the ruling, and that
it supersedes the 2026-08-18 "keep one noun, drop the person" compromise.
