## 2026-08-10 · fix(open-shop): step 3 could not be passed at all — plus a round logo crop and name capitalisation

Three owner reports, one of them a hard blocker on a live flow.

### 🔴 "Cannot continue step 3. i placed a name but it still said 'Add the owner name.'"

**`formRef` was declared and read but never ATTACHED to the `<form>`.** `validateStep` reads every step-3 and step-4 field off that element by name; with `formRef.current` null, each read returned `''` and step 3 refused a name that was plainly in the box. **Nobody could finish onboarding.** Mine, introduced in the four-step restructure yesterday.

🔑 **It failed silently in the worst possible way.** Optional chaining meant no crash and no console error, and the message named a real field — so it read as *"the form is being strict"*, not *"the form is broken"*. `tsc` is perfectly happy with a declared-and-unused ref; so is eslint. The full unit suite was green. **The only detector was a person trying to use it.**

Two guards now, both mutation-verified: one asserts `ref={formRef}` is on the `<form>` element specifically (a ref attached to a `<div>` types fine and still returns null from `.elements`), and one asserts **every field name `validateStep` asks for is actually rendered by an input** — because a rename of `contact_phone` would recreate the identical dead end one field at a time. Detaching the ref again turns the suite red.

### Logo preview is a round crop

Owner: *"Profile Logo must be cropped to a round image."* `FileUpload` gains an opt-in `roundPreview`.

⚠ **Opt-in, not applied to every `square` field.** The same variant carries evidence photos and government IDs in the verification flow, where a circular crop hides the corners of a document — the part that carries the seal.

`object-cover`, not `object-contain`: this is a *crop* preview, so it has to crop. Letterboxing a wide logo inside the circle would show the vendor a shape they will not get.

⏭ **Flagged, not swept:** vendor logos are NOT round anywhere else yet — on the Explore card the logo is a full-bleed hero fallback, not an avatar. Whether every surface should become round is a design call across many screens, not a side effect of the upload field.

### Names get their capital letter

Owner: *"Your Name must always have the first letter in capital."* `titleCasePersonName` is applied **on the server**, so what is STORED is capitalised — fixing it only in the input would leave `ana reyes` in the database and on the shop page, the marketplace card and every message to a couple. The input also capitalises on **blur**, not per keystroke: rewriting the box mid-word fights the typist and moves the caret.

🔑 **It capitalises and lowercases NOTHING.** A naive title-caser damages real Filipino names — **de la Cruz** → "De La Cruz", **dela Peña**, **del Rosario**, **JR** → "Jr", **MJ** → "Mj". Getting someone's own name wrong is worse than leaving it as they typed it. So: a name typed entirely in lower case gets every word capitalised (nobody deliberately writes their whole name lower case on a business form — this is the actual complaint, and no intent can be destroyed); any name with capitals in it already is treated as intentional and only its first letter is guaranteed. Six tests, three of them dedicated to what it must leave alone.

Verified: **7308/7308** unit · all 20 `lint-*.mjs` · `tsc` clean · eslint clean.

SPEC IMPACT: None.
