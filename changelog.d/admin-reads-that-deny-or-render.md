## 2026-08-18 · fix(admin): eight reads whose absence rendered as data

Follow-up to #4519. A new rule in the console-table guard work catches the
destructure-and-rename form — `const { data: x } = await …` with no error bound —
which is invisible to a scan for the literal `data ?? []`. It reported **nine**
reads across six of the ten files converted in lane D.

**The only question asked of each: does an absence RENDER AS DATA, or does it
DENY?** Absence that renders as data is the defect; absence that denies is the
fix. Eight rendered. One denies and is exempt.

### Fixed — absence rendered as data (8)

| file · read | what a refused read showed |
|---|---|
| `vendor-partnerships` · `rawProposed` | **"No open partnership proposals. Set na 'yan."** on HQ's only veto surface |
| `vendor-partnerships` · `allVendors` | an **empty picker** — no shop selectable, nothing saying why |
| `vendor-partnerships` · `cats` | no category checkboxes at all |
| `vendor-partnerships` · `vendorNames` | shop names silently replaced by internal reference codes |
| `account-deletions` · `usersData` | every email in the deletion queue as `—` |
| `demo-vendors/inquiries` · `events` | every row as **"Couple"** |
| `papic-storage` · `evs` | every event name as `—` |
| `settings/payment-methods` · `inflow` | a **falsely high remaining-capacity figure** |

🔑 **`rawProposed` is the one that stings: it is in a file I already fixed.** The
LIVE partnerships read was corrected in #4519 and the OPEN PROPOSALS read, forty
lines above it, was not. Fixing the instance in front of you is not fixing the
file — enumerate every read, not the one the brief named.

🔑 **`allVendors` reaches an end state this exact dropdown has already been in.**
The file's own comment records it: a phantom `is_active` column made PostgREST
answer 42703, so the dropdown "was ALWAYS EMPTY: an admin could never add a
partnership." Fixing that phantom column fixed one *cause*; the *symptom* stayed
unreportable, because any other refusal still renders `?? []` as an empty
`<select>`. The failure can now say itself.

🚨 **The payments meter was the dangerous one, and "fail soft" was the wrong
trade.** Its comment said a read error "leaves the sums at zero and the meter
simply reads low." It does not read low — headroom is cap MINUS inflow, so a
falsely-zero inflow reads **HIGH**, telling the owner a rail can still receive
money it cannot. Transfers past a full account **fail rather than queue**, and
this page's own copy already states the principle: *"a working-looking button on
a full account is worse than an honest pause."* An unmeasured inflow now claims
no headroom at all and says so; the settings form still renders either way,
which was the legitimate half of the original trade. The `catch` path is treated
identically — a throw is the same claim as a refusal: nothing was counted.

⚖ **A dash is not available as an error signal**, which is why each of these is a
sentence rather than a silent fallback: `—` is *already* the legitimate value for
a shop with no name, an account with no email, an event with no title. "Couple"
is *already* the deliberate pre-accept masking on the demo inbox. Reusing them
for "we could not look it up" makes the two indistinguishable, so the page names
which one it means.

### Exempt — absence denies (1)

`compliance/data-sheet` · `me` — `const { data: me }` feeds
`if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) notFound()`.
Null → every disjunct false → `notFound()`. **Fails closed**, which is the
correct failure mode for an authorization read, so it must be exempted rather
than "fixed". The proof to pin it to is that `notFound()` line — not the read.

### Verification

⚠ Test-proved and measured, **not observed** — admin is behind a login.

- 8,578 unit tests pass; typecheck clean; port lint, masthead, contrast, colour
  and engineering-notes lints all pass. No control lost, so the port baseline is
  untouched.
- Each of the eight verified twice: the error is **bound** at the read, and the
  resulting flag **reaches the JSX**. Binding alone was not accepted as done —
  logging never changed the render.

SPEC IMPACT: None.
