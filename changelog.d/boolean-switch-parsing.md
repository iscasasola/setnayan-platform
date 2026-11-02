## 2026-08-09 · fix(config): switches stop silently ignoring TRUE, 1, yes and on

**What a person experiences.** Setting a switch to `TRUE`, `1`, `yes` or `on` — or
leaving an invisible trailing space after `true` — now turns the feature on. Before,
44 of these switches demanded the exact lowercase word `true` and did nothing at all
for any other spelling: no error, no log line, nothing on screen. That already cost a
deploy cycle once (the owner set the Papic login-free switch, redeployed, and the
login wall stayed up).

**What changed.** 49 reader sites across 43 files now go through the shared forgiving
parser `lib/env-flag.ts`, which was already in the repo but had been adopted at
exactly one site. ON = `true` / `TRUE` / `True` / `1` / `yes` / `on`, case-insensitive
and whitespace-trimmed. Everything else — unset, empty, `false`, `0`, `no`, `off`,
and any typo — stays OFF. Fail-closed is deliberate and unchanged.

**Done one switch at a time, never as a sweep.** Kill-switches written `!== 'false'`
(default ON) were left alone: running them through this parser would invert their
default and turn features on in production. Form-field comparisons
(`formData.get('x') === 'true'`) were left alone too — nobody types those, the app
emits them.

**Five switches deliberately held strict**, each with a one-line note at its own
reader saying why, because widening what counts as "on" there is a compliance or
owner decision rather than a parsing bugfix:

| switch | why held |
|---|---|
| `CSAM_HASH_MATCH_ENABLED` | needs provider enrolment + a signed NPC Circular 16-02 agreement |
| `NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED` | gates biometric processing — DPO call |
| `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED` | starts a new data-collection practice — DPO call |
| `PAPIC_CLIP_DROP_ENABLED` (2 readers) | arms an irreversible replacement of full-res clip originals |

**Guard.** `lib/env-flag.test.ts` carries a registry of every converted site and
asserts (a) each still reads through the parser, (b) none regressed to a bare string
comparison, and (c) the five holdouts stay strict AND keep the sentence explaining
why. All assertions run on comment-stripped source, so a docblock quoting the old
form cannot satisfy them. Mutation-tested 8 ways, including a scope control proving
the guard ignores comments.

Eight pre-existing tests that asserted the old "only the literal string true"
behaviour were updated to the new contract; each kept its real safety claim (unset /
`false` / empty must never enable).

SPEC IMPACT: None — no product, pricing or scope decision. Behaviour changes only for
environment values that previously did nothing at all.
