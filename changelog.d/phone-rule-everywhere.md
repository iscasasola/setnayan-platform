## 2026-08-10 · fix(vendors): the number rule now holds everywhere a number can be set

The rule shipped on the signup screen only. 🔑 **That is the weaker half of it.** A vendor passes on day one and replaces the number with anything the next day — on **My Shop**, which is where a number actually gets changed. This repo has shipped that shape before: a rule enforced on the path somebody was thinking about, and absent on the path people use.

| where a vendor number can be set | before | now |
|---|---|---|
| signup | ✅ checked | ✅ |
| **My Shop** — the screen a number is actually changed on | ❌ stored whatever was typed | ✅ |
| **admin seeding an unclaimed shop** | ❌ | ✅ |

**My Shop** also stores the canonical `+63…` form, so the same number is one value regardless of which screen set it — otherwise a shop created at signup and edited later carries two spellings of the same line. Validated there for the same reason the email field beside it is: the inline editor submits with `noValidate`, so nothing in the browser is checking.

**The admin seeder** matters more than it looks: a number planted there is inherited by the vendor when they claim the shop, so a value the vendor themselves would be refused for arrives **wearing our own approval**.

### ⚠ One writer deliberately left alone

The **couple's own vendor list** is not checked, and a test records why so it is not "fixed" later.

That list is a couple's private record of a supplier **they** hired — who may genuinely be foreign, or a relative abroad. Refusing a real number a couple is trying to save would be the rule applied to the wrong person entirely: **the Philippine constraint is about Setnayan vendors, not about everyone a couple knows.**

Mutation-tested: making My Shop store the raw text again turns the guard red.

Verified: **7457/7457** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.
