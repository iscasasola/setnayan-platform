/**
 * VENDOR VERIFICATION DOCUMENTS — the pure half.
 *
 * These are a vendor's government ID, DTI certificate, BIR 2303, mayor's permit
 * and bank proof. They live in their OWN bucket (`setnayan-vendor-verification`)
 * and they are the most sensitive personal data the platform holds.
 *
 * ── WHY THIS IS NOT PART OF /admin/website-media ────────────────────────────
 * That page manages the SITE'S OWN FURNITURE — logos, hero art, nav icons. A
 * person's passport photo is not furniture. Keeping the two apart means the
 * blast radius of a mistake on either page stops at that page, and it means the
 * copy on this one can say what these files actually are.
 *
 * ── WHAT "IN USE" MEANS HERE, EXACTLY ───────────────────────────────────────
 * A document is IN USE when a database row still points at its key. Two places
 * point:
 *   · `vendor_verifications` — five `*_r2_key` text columns, one per document.
 *   · `vendor_verification_applications.doc_uploads` — a jsonb map of
 *     slot → VALUE for an in-progress intake. ⚠ The value is NOT a key and
 *     never has been: `buildSlotValue` writes `{ r2_key, uploaded_at }`, an
 *     ARRAY of those for `portfolio_samples`, an array for
 *     `client_references`, a platform map for `social_media`, and `null` for a
 *     cleared slot. Reading `Object.values()` and keeping the strings — which
 *     is what this page shipped with — collects NOTHING, from any of them.
 * Anything in the bucket that no row names is LEFT OVER: a re-upload that
 * replaced it, or an application abandoned before submission.
 *
 * 🔑 **THE PREFIX COMES FROM THE UPLOAD CALL SITES, NOT FROM A MODULE NAME.**
 * `vendors/<vendorProfileId>/verification/<slot>` is what
 * `vendor-dashboard/verify/page.tsx:543`, `shop/_components/docs-body.tsx` and
 * `lib/r2-client-ref.ts:366` actually write. A previous media page shipped an
 * allowlist derived from names instead, and it matched ZERO objects.
 */

// RULE 0 — neither of these is written here. The erasure sweep's walk already
// reads this exact JSONB (its docstring explains the array slots), and the
// `r2://` decode already exists nine times over.
//
// ⚠ `parseR2Ref` lives in `nsfw-screen.ts` because that is the ONLY pure,
// exported copy: `lib/uploads.ts` (`parseStoredAsset`) and `lib/r2.ts` both
// open with `import 'server-only'`, which is not installed here, so a rule kept
// there is untestable by behaviour; `publicAssetTarget` refuses private buckets
// by design and this bucket is private; `keyFromRef` is gated on the site-media
// prefixes. The coupling is real and worth a note: nsfw-screen's top level is
// `import type` only today, and a runtime import added there would stop this
// module (and its test) from loading. If that happens, lift `parseR2Ref` into
// its own pure module rather than re-typing the arithmetic here.
import { collectStoredAssetRefs } from '@/lib/erasure/coverage';
import { parseR2Ref } from '@/lib/nsfw-screen';

/** One object in the verification bucket, as the admin page sees it. */
export type VerificationDoc = {
  key: string;
  size: number;
  lastModified: string | null;
  /** The vendor this key belongs to, read from the key itself. */
  vendorProfileId: string | null;
  /** The document slot (`government_id`, `dti_certificate`, …), from the key. */
  slot: string | null;
  state: 'in_use' | 'left_over' | 'unrecognised';
};

/** The uploaders' prefix. Everything this page manages sits under it. */
export const VERIFICATION_PREFIX = 'vendors/';

/**
 * Why the page refuses to delete when it can see files but no references.
 *
 * Rendered verbatim, so it has to read as a sentence a person can act on.
 */
export const EMPTY_REFERENCE_SET_REASON =
  'no vendor record points at ANY file in this bucket — which is what a broken check looks like, not what a tidy bucket looks like';

/**
 * Every string a stored reference value could be naming, at any depth.
 *
 * ── WHY THIS IS NOT `Object.values(doc_uploads)` ────────────────────────────
 * That is the bug this function exists to kill. `buildSlotValue` NEVER stores a
 * bare string: a normal document slot is `{ r2_key, uploaded_at }`,
 * `portfolio_samples` is an ARRAY of those, `client_references` is an array of
 * objects and `social_media` is a platform → link map. A `typeof value ===
 * 'string'` filter over the top level matches none of them, so the referenced
 * set came back EMPTY BY CONSTRUCTION and the first real government ID a
 * supplier uploaded was labelled "left over" with a permanent Delete beside it.
 *
 * ── WHY IT COLLECTS PLAIN STRINGS, WHICH LOOK LIKE NOISE ────────────────────
 * Both SEC-1 gates (`verify/actions.ts`, `shop/inline-docs-actions.ts`) admit a
 * value that does NOT start with `r2://` unconditionally — `!ref.startsWith(...)
 * ||` short-circuits ownership to true — so a BARE key is a legal stored shape,
 * and the erasure walk, which requires the scheme, provably drops one. Rather
 * than guess which plain strings are keys (a guess that is wrong DELETES
 * something), keep them all: a timestamp, a social URL or a referee's name can
 * never equal an object key from `ListObjectsV2`, so keeping it costs nothing.
 *
 * `r2://` refs are deliberately NOT collected here — `collectStoredAssetRefs`
 * owns those, and splitting the two makes each half separately provable.
 *
 * 🔑 **THE ONLY DIRECTION THAT CAN HURT SOMEBODY IS UNDER-COLLECTION.** An
 * extra string in the set can at worst refuse a delete. A missing one erases an
 * identity document with no undo. Every judgement call here goes the first way.
 */
export function collectPlainStringsDetailed(
  raw: unknown,
  maxDepth = 8,
): { strings: string[]; truncated: boolean } {
  const found = new Set<string>();
  let truncated = false;
  const walk = (value: unknown, depth: number): void => {
    if (value === null || value === undefined) return;
    // 🚨 A WALK THAT STOPS AT A DEPTH RETURNS A **SMALLER** SET, WHICH IS THE
    // DANGEROUS DIRECTION ON THIS PAGE — fewer references means more documents
    // labelled "left over" with an irreversible Delete beside them. It used to
    // stop silently. It now SAYS it stopped, and the caller fails closed: a
    // truncated walk makes the whole reference read incomplete, which switches
    // deletion off page-wide. 8 is deep enough for every shape `buildSlotValue`
    // writes (3 at most), and "deep enough for the shapes we know" is exactly
    // the claim that must not be trusted silently for a shape nobody has
    // written yet.
    if (depth > maxDepth) {
      truncated = true;
      return;
    }
    if (typeof value === 'string') {
      // 🚨 THE EXCLUSION IS COMPUTED ON THE **RAW** STRING, ON PURPOSE, AND
      // MUST STAY THAT WAY. `collectStoredAssetRefs` — the other half — decides
      // what it owns with `value.startsWith('r2://') && value.length >
      // 'r2://'.length` on the raw string. This half used to exclude on
      // `value.trim().startsWith('r2://')`, which is a WIDER test than the one
      // that includes, so the gap between them was a hole neither half covered:
      // measured, `" r2://<bucket>/<key>"` with ONE leading space came back
      // half1=0 half2=0, landed in no set at all, and the government ID it
      // names was classified `left_over` with Delete beside it.
      // 🪤 AND THE FIRST REPAIR LEFT A SMALLER GAP OF THE SAME SHAPE: it
      // dropped the `.trim()` but not the LENGTH clause, so the bare literal
      // `"r2://"` was excluded here and not included there (measured: half1=0
      // half2=0). Harmless — a five-character scheme can never equal a
      // `vendors/…` object key — but the comment claimed the two predicates
      // were computed identically, and they were not. They are now, character
      // for character.
      // 🔑 TWO PREDICATES THAT DIVIDE ONE JOB MUST BE COMPUTED ON THE SAME
      // STRING BY THE SAME TEST. Whichever way they disagree, one side is a
      // silent hole.
      if (value.startsWith('r2://') && value.length > 'r2://'.length) return;
      // Both forms are kept, and only ever added. The trimmed form is what
      // matches a stored value written with stray whitespace; the RAW form is
      // what matches an object key that genuinely ends in a space. Keeping only
      // the trimmed one made the "kept raw" claim overstated — unreachable in
      // practice (`sanitizeFilename` maps everything outside `[a-zA-Z0-9._-]`
      // to `-`), but a claim broader than its mechanism is what this repo keeps
      // paying for.
      if (value.length > 0) found.add(value);
      const t = value.trim();
      if (t.length > 0) found.add(t);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) walk(v, depth + 1);
    }
  };
  walk(raw, 0);
  return { strings: [...found], truncated };
}

/** Every plain string, discarding the truncation signal. Prefer the detailed form. */
export function collectPlainStrings(raw: unknown, maxDepth = 8): string[] {
  return collectPlainStringsDetailed(raw, maxDepth).strings;
}

/**
 * Turn one stored value — a whole `doc_uploads` blob, or a single `*_r2_key`
 * column — into every key it could be naming.
 *
 * ── BOTH SIDES OF THE COMPARISON, NORMALISED ────────────────────────────────
 * The listing hands back a BARE S3 key (`r2List` pushes `o.Key` verbatim). The
 * database stores a FULL `r2://<bucket>/<key>` ref (`encodeR2Ref`). Those two
 * are never equal, so widening the walk ALONE still marks every live document
 * deletable — measured, not assumed. Each collected string therefore goes in
 * TWICE: raw, and again as the bare key `parseR2Ref` resolves out of it.
 *
 * ── WHAT "ERRS TOWARD IN USE" DOES AND DOES NOT MEAN ───────────────────────
 * 🛑 This docstring used to claim that a shape neither form recognises "still
 * lands in the set raw, so it errs toward 'in use'". **THAT WAS FALSE AS
 * WRITTEN, and a docstring that overstates a safety property is worse than
 * none.** The set is compared against BARE LISTING KEYS, so a raw value that is
 * not itself a bare key protects NOTHING. Measured against a non-empty set — so
 * the empty-set gate could not mask it — every one of these came back
 * `left_over`, `deletable: true`:
 *   · a presigned `https://…/<bucket>/<key>?X-Amz-Signature=…`
 *   · a public host `https://media.setnayan.com/<key>` · `https://pub-…r2.dev/<key>`
 *   · `R2://` with an uppercase scheme
 *   · a bare key carrying a leading slash, `/vendors/<id>/verification/…`
 * These are legal stored values: both SEC-1 ownership gates short-circuit on
 * `!ref.startsWith('r2://')`, so ANY non-`r2://` string is admitted
 * unconditionally, `lib/uploads.ts` and `lib/vendor-identity-retention.ts` both
 * model `legacy_url` as a real shape for this data, and `file-upload.tsx`
 * explicitly supports legacy `http(s)` values.
 *
 * `referenceCandidateForms` now DERIVES a key from each of those, so the claim
 * is true of them. **It is still not true in general**, and this is the honest
 * statement of the ceiling: a value whose key cannot be derived is kept RAW,
 * which protects an object only if the object's own key is that same string.
 * Anything else is a shape nobody has written yet and nobody has covered.
 *
 * ⚖ NO BUCKET FILTER. A ref naming `setnayan-media` (a portfolio sample — the
 * writer accepts `vendorOwnedMediaPolicy` too) is kept. Dropping it could only
 * ever ENABLE a delete, and this is a government ID.
 *
 * 🔑 RULE 0 — the `r2://` walk is the erasure sweep's own
 * `collectStoredAssetRefs`, written for this exact JSONB and already
 * mutation-guarded. It is not re-implemented here; it is unioned with the plain
 * walk that covers the shapes it cannot see. Union, never intersection: a ref
 * either half finds is a ref that counts, and gutting either goes RED.
 */
export function referencedKeysDetailedFrom(raw: unknown): {
  keys: string[];
  truncated: boolean;
} {
  const out = new Set<string>();
  const plain = collectPlainStringsDetailed(raw);
  const candidates = new Set<string>([
    // Half one: every `r2://` ref, at any depth. The erasure sweep's own walk.
    ...collectStoredAssetRefs(raw),
    // Half two: everything that walk cannot see — a bare key, a legacy URL, or
    // any shape nobody has written yet.
    ...plain.strings,
  ]);
  for (const candidate of candidates) {
    for (const form of referenceCandidateForms(candidate)) out.add(form);
  }
  // ⚠ `collectStoredAssetRefs` has a depth ceiling of its own and no way to
  // report it. Our walk carries the same ceiling over the same value, so if
  // ours stopped short, theirs did too — this flag stands for both, and the
  // caller turns it into `complete: false`.
  return { keys: [...out], truncated: plain.truncated };
}

/** Every key this value could be naming, discarding the truncation signal. */
export function referencedKeysFrom(raw: unknown): string[] {
  return referencedKeysDetailedFrom(raw).keys;
}

/**
 * Every key one stored string could be naming.
 *
 * 🔑 **THIS FUNCTION ONLY EVER ADDS.** The trimmed input is always the first
 * entry, and every rule below appends a derived form beside it — none replaces
 * it, none filters. That is the property that makes an over-eager rule
 * harmless: the worst an extra string can do is refuse a delete, and the worst
 * a missing one does is erase an identity document with no undo.
 *
 * The forms, and why each is a real stored shape rather than a hypothetical:
 *  1. **The trimmed raw value.** Always.
 *  2. **`r2://<bucket>/<key>` → `<key>`**, case-insensitively. The listing hands
 *     back bare keys; the database stores full refs. Without this the whole fix
 *     is inert. The scheme is lowercased before parsing because `R2://` is a
 *     string a hand-written row or a future writer can hold and `parseR2Ref` is
 *     anchored on the lowercase literal.
 *  3. **A leading slash stripped.** `/vendors/…` and `vendors/…` name the same
 *     object; S3 keys have no leading slash and `ListObjectsV2` never returns
 *     one.
 *  4. **An `http(s)` URL → its decoded path, and the path from `vendors/`
 *     onward.** Covers a presigned GET (path-style puts the bucket in front of
 *     the key), a public custom domain and an `r2.dev` host. The KEY is derived
 *     from the path — the bucket is never guessed — and the query string goes
 *     with it, which is what strips `X-Amz-Signature`.
 *
 * ⚠ A shape none of these recognises keeps only form 1, and form 1 protects an
 * object only when the object's key IS that string. Say that out loud rather
 * than implying cover: see `referencedKeysFrom`.
 */
export function referenceCandidateForms(candidate: string): string[] {
  const out = new Set<string>();
  const value = candidate.trim();
  if (value.length === 0) return [];
  // The UNTRIMMED value first. `trim()` on both sides used to be the only form
  // kept, which silently dropped the one shape it claimed to protect: a stored
  // value equal to an object key that ends in a space. Unreachable in practice
  // — `sanitizeFilename` in `/api/upload` maps everything outside
  // `[a-zA-Z0-9._-]` to `-` and keys are minted server-side — but this function
  // ONLY EVER ADDS, so making the claim true costs one line.
  if (candidate.length > 0) out.add(candidate);
  out.add(value);

  // 2 · the scheme, case-insensitively.
  const schemeNormalised = /^r2:\/\//i.test(value) ? `r2://${value.slice('r2://'.length)}` : value;
  const { bucket, key } = parseR2Ref(schemeNormalised);
  const bare = bucket !== null ? key.trim() : value;
  if (bare.length > 0) out.add(bare);

  // 3 · a leading slash. Applied to whatever form 2 produced, so
  // `r2://b//vendors/…` lands on the same key as `/vendors/…`.
  const unslashed = bare.replace(/^\/+/, '');
  if (unslashed.length > 0) out.add(unslashed);

  // 4 · a legacy http(s) URL, or a protocol-relative `//host/key`. `URL` throws
  // on anything that is not one, which is the cheapest way to ask "is this a
  // URL" without a regex that guesses. A protocol-relative value is given a
  // scheme rather than being left to fall through to form 3, where the leading
  // slashes strip to `host/key` and the host is wrongly kept as part of the key.
  const urlish = /^https?:\/\//i.test(value)
    ? value
    : value.startsWith('//')
      ? `https:${value}`
      : null;
  if (urlish !== null) {
    try {
      const parsed = new URL(urlish);
      let path = parsed.pathname.replace(/^\/+/, '');
      try {
        path = decodeURIComponent(path);
      } catch {
        // A malformed escape sequence. Keep the undecoded path — it is still a
        // better candidate than nothing, and this can only ever add.
      }
      if (path.length > 0) out.add(path);
      // Path-style presigned URLs carry `/<bucket>/<key>`; a public host
      // carries `/<key>`. Taking everything from the first `vendors/` derives
      // the key in both cases WITHOUT guessing which bucket is in front of it.
      const at = path.indexOf(`${VERIFICATION_PREFIX}`);
      if (at > 0) out.add(path.slice(at));
    } catch {
      // Not a URL after all. Forms 1–3 still stand.
    }
  }

  return [...out];
}

/**
 * Fold every reference source into ONE set of keys.
 *
 * 🛡 **THIS LOOP LIVES HERE, IN THE PURE MODULE, BECAUSE IT IS THE DEFECT
 * SURFACE.** It used to sit in `verification-docs-server.ts`, which opens with
 * `import 'server-only'` — a module no `node:test` can load — so the only guard
 * over it read the file as TEXT and asserted `referencedKeysFrom(` appeared
 * twice. An adversarial reviewer kept both of those call sites and simply threw
 * their results away (`keys.add(key)` 2 → 0). The reference set was empty by
 * construction again — the original defect, restored — and the suite reported
 * `# tests 32 # fail 0`.
 *
 * 🔑 **THE ANSWER TO AN UNTESTABLE MODULE IS TO SPLIT THE RULE OUT OF IT, NEVER
 * TO MATCH A LONGER STRING.** The server module now fetches rows and hands them
 * here; it makes no decision of its own, so there is nothing left there for a
 * source-match to have to stand in for.
 */
export function collectReferencedKeysDetailed(sources: Iterable<unknown>): {
  keys: Set<string>;
  truncated: boolean;
} {
  const keys = new Set<string>();
  let truncated = false;
  for (const source of sources) {
    const got = referencedKeysDetailedFrom(source);
    for (const key of got.keys) keys.add(key);
    if (got.truncated) truncated = true;
  }
  return { keys, truncated };
}

/** The folded set, discarding the truncation signal. */
export function collectReferencedKeys(sources: Iterable<unknown>): Set<string> {
  return collectReferencedKeysDetailed(sources).keys;
}

/**
 * Read every page of a reference source, and say whether it got to the end.
 *
 * 🔴 **THE DANGEROUS SIDE OF THIS PAGE IS THE REFERENCE SIDE, NOT THE LISTING
 * SIDE, AND THE ORIGINAL CODE GUARDED THE WRONG ONE.** A short LISTING offers
 * FEWER files, so it can only ever refuse a cleanup. A short REFERENCE READ
 * offers MORE deletions — every document belonging to a row past the cut reads
 * as "nothing points at this".
 *
 * Neither reference SELECT carried a `.limit()`, a `.range()` or a count, while
 * PostgREST caps what it returns (Supabase's documented default for that
 * setting is 1000 rows). When it caps, the set comes back LARGE, NON-EMPTY and
 * INCOMPLETE with `error: null` — which sails past the error gate AND past the
 * empty-set gate. 🔑 **That is the same disease as the bug this branch fixes,
 * one axis over: a SUCCESSFUL read returning an INCOMPLETE set, feeding an
 * IRREVERSIBLE delete.**
 *
 * ── 🛑 A SHORT PAGE IS NOT PROOF OF THE END, AND THIS USED TO ASSUME IT WAS ──
 * The first repair paged until a page came back SHORTER than `pageSize` and
 * called that the end. That is only sound while `pageSize` is strictly BELOW
 * the server's row cap — and the cap is PROJECT CONFIGURATION. It is not in
 * `pg_db_role_setting`, so no session can read it, and a reviewer probed the
 * consequence directly: with a cap of 3 against a `pageSize` of 4, the very
 * first capped page came back short and the read declared itself COMPLETE.
 * Silent truncation, feeding an irreversible delete — the original bug
 * restored, behind the guard written to prevent it.
 *
 * ⚖ **SO COMPLETENESS IS NOT INFERRED FROM A PAGE'S SHAPE ANY MORE. IT IS
 * PROVED AGAINST THE SERVER'S OWN EXACT COUNT** (`{ count: 'exact' }`), which
 * PostgREST reports in `Content-Range` for the WHOLE match regardless of how
 * many rows it was willing to hand over. The read is complete when the rows
 * collected reach that number, and never otherwise. That is a proof that does
 * NOT depend on knowing the cap:
 *   · cap ≥ pageSize → each page fills, the count is reached, complete.
 *   · cap < pageSize → each page comes back short, the NEXT page starts at the
 *     number of rows actually collected (never at a fixed stride), and the
 *     count is still reached. Nothing is skipped and nothing is assumed.
 *   · no count reported → `complete: false`. FAIL CLOSED. A read that cannot
 *     prove it finished is treated exactly like one that failed.
 *   · a page that returns zero rows before the count is reached → also
 *     `complete: false`, because that is what a cap of zero, a filter change or
 *     a mid-read shrink looks like.
 *
 * ⛔ Raising a limit is the same bug with a bigger number.
 *
 * ⚠ HONEST LIMIT, stated rather than implied: this is OFFSET paging over a
 * stable `.order()`. A row deleted between two pages shifts the window and can
 * drop a row from the read — under-collection, the dangerous direction. The
 * count check narrows it (a shrink is usually visible as a lower total) but
 * does not eliminate it. Keyset paging on the primary key would, and it needs
 * the primary key in the projection, which is exactly what finding 1 says must
 * not be folded into the reference set. If this table ever grows past one page
 * in practice, that is the change to make — with the PK read into a variable
 * and kept OUT of the fold.
 *
 * `fetchPage` is injected so this is testable by behaviour rather than by
 * reading the server module's source.
 */
export async function readAllPages(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ rows: unknown[] | null; error: string | null; total?: number | null }>,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<{ rows: unknown[]; error: string | null; complete: boolean }> {
  const pageSize = Math.max(1, opts?.pageSize ?? 500);
  const maxPages = Math.max(1, opts?.maxPages ?? 200);
  const rows: unknown[] = [];
  let total: number | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    // The next window starts at what has ACTUALLY been collected, never at
    // `page * pageSize`. That is what makes a server cap below `pageSize`
    // harmless instead of silent.
    const from = rows.length;
    const { rows: got, error, total: reported } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error, complete: false };
    if (typeof reported === 'number') total = reported;
    const batch = got ?? [];
    rows.push(...batch);
    if (total !== null && rows.length >= total) return { rows, error: null, complete: true };
    // No progress and the count not reached: a cap of zero, or the table moved
    // under us. Either way this is not the end, and saying so is the point.
    if (batch.length === 0) return { rows, error: null, complete: false };
  }

  return { rows, error: null, complete: false };
}

/**
 * WHERE THE REFERENCES LIVE — the two sources, as data.
 *
 * 🔴 **THE PRIMARY KEY IS DELIBERATELY NOT IN `referenceColumns`, AND THAT IS
 * THE WHOLE POINT OF THIS TYPE.** A round of this branch put `verification_id`
 * and `application_id` into the SELECT (to order by them) and then handed the
 * WHOLE ROW to the fold. `collectPlainStrings` keeps every string at any depth,
 * so each row's PK UUID was collected as though it were a document reference —
 * and the empty-reference-set gate, which counts what the fold produced, could
 * never fire again from the first verification row onward.
 *
 * ⚖ PostgREST orders by a column whether or not it is projected, so the PK
 * never needed to be in the SELECT at all. `pkColumn` is the ORDER; the SELECT
 * is `referenceColumns` and nothing else.
 */
export type ReferenceSource = {
  /** The table to read. */
  table: 'vendor_verifications' | 'vendor_verification_applications';
  /** The stable order. Ordered by, never selected — see above. */
  pkColumn: 'verification_id' | 'application_id';
  /** ONLY the columns that can carry a document reference. */
  referenceColumns: readonly string[];
};

export const VERIFICATION_REFERENCE_SOURCES: readonly ReferenceSource[] = [
  {
    table: 'vendor_verifications',
    pkColumn: 'verification_id',
    referenceColumns: [
      'dti_certificate_r2_key',
      'bir_2303_r2_key',
      'mayors_permit_r2_key',
      'government_id_r2_key',
      'bank_account_proof_r2_key',
    ],
  },
  {
    table: 'vendor_verification_applications',
    pkColumn: 'application_id',
    referenceColumns: ['doc_uploads'],
  },
];

/** The SELECT list for one source. Reference columns only — never the PK. */
export function referenceSelectColumns(source: ReferenceSource): string {
  return source.referenceColumns.join(', ');
}

/** What one reference page's query resolves to. Shaped like postgrest-js. */
export type ReferenceQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/**
 * The smallest slice of the Supabase client this module needs.
 *
 * 🛡 **THE QUERY IS BUILT HERE, IN THE PURE MODULE, BECAUSE IT IS A DEFECT
 * SURFACE AND IT WAS UNGUARDED.** While it lived in
 * `verification-docs-server.ts` — a module that opens with `import 'server-only'`
 * and which no `node:test` can load — two mutations against it stayed GREEN at
 * 55/55: shifting the range window by one row (`from, from + pageSize - 1` →
 * `from + 1, from + pageSize`), which silently skips the FIRST row of the table
 * and offers its five documents for deletion; and DELETING the `.order()` the
 * code's own comment calls "what makes paging meaningful". Every test injected
 * a `fetchPage` stub that ignored its arguments, so the real window and the
 * real ordering were exercised by nothing.
 * 🔑 The answer to an untestable module is to SPLIT THE RULE OUT of it, not to
 * match a longer string. A fake client can now record the table, the columns,
 * the count option, the order and every range window, and assert all five.
 */
export type ReferenceQueryClient = {
  from(table: string): {
    select(
      columns: string,
      options: { count: 'exact' },
    ): {
      order(
        column: string,
        options: { ascending: boolean },
      ): {
        range(from: number, to: number): PromiseLike<ReferenceQueryResult>;
      };
    };
  };
};

/** One page of one reference source, with the server's exact total. */
export async function fetchReferencePage(
  client: ReferenceQueryClient,
  source: ReferenceSource,
  from: number,
  to: number,
): Promise<{ rows: unknown[] | null; error: string | null; total: number | null }> {
  const res = await client
    .from(source.table)
    .select(referenceSelectColumns(source), { count: 'exact' })
    .order(source.pkColumn, { ascending: true })
    .range(from, to);
  return {
    rows: (res.data ?? null) as unknown[] | null,
    error: res.error ? `${source.table}: ${res.error.message}` : null,
    total: res.count ?? null,
  };
}

/** One reference source, read to exhaustion and proved against its own count. */
export async function readReferenceSource(
  client: ReferenceQueryClient,
  source: ReferenceSource,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<{ rows: unknown[]; error: string | null; complete: boolean }> {
  return readAllPages((from, to) => fetchReferencePage(client, source, from, to), opts);
}

/**
 * Pull the vendor id and document slot out of a key.
 *
 * Returns nulls rather than throwing on a shape we do not recognise — an
 * unrecognised object still has to be LISTED, because the whole point of this
 * page is to show what is really there. Silently dropping it would hide exactly
 * the file someone needs to find.
 */
export function parseVerificationKey(key: string): {
  vendorProfileId: string | null;
  slot: string | null;
} {
  const m = /^vendors\/([^/]+)\/verification\/([^/]+)/.exec(key);
  if (!m) return { vendorProfileId: null, slot: null };
  const [, vendorProfileId, rest] = m;
  // The slot is the leading segment of the filename, before any timestamp or
  // extension the uploader appended.
  const slot = (rest ?? '').split('.')[0] ?? null;
  return { vendorProfileId: vendorProfileId ?? null, slot };
}

/**
 * Classify every object against the set of keys the database still references.
 *
 * `referenced` must be the COMPLETE set. A partial set would mark a live
 * document as left over, and this page can delete what it marks — so a caller
 * that fails to read one of the two sources must not call this at all.
 */
export function classifyVerificationDocs(
  objects: ReadonlyArray<{ key: string; size: number; lastModified: Date | null }>,
  referenced: ReadonlySet<string>,
): VerificationDoc[] {
  return objects.map((o) => {
    const { vendorProfileId, slot } = parseVerificationKey(o.key);
    const state: VerificationDoc['state'] = referenced.has(o.key)
      ? 'in_use'
      : vendorProfileId === null
        ? 'unrecognised'
        : 'left_over';
    return {
      key: o.key,
      size: o.size,
      lastModified: o.lastModified ? o.lastModified.toISOString() : null,
      vendorProfileId,
      slot,
      state,
    };
  });
}

/**
 * Is this key safe to delete?
 *
 * ONLY when the database references nothing that points at it. This is the
 * single gate on an irreversible action against identity documents, and it is
 * deliberately a re-derivation at delete time rather than a flag carried from
 * the page — the listing a person is looking at may be minutes old, and a
 * document can become referenced in between.
 *
 * 🪤 An `unrecognised` key is NOT deletable. We could not read a vendor out of
 * it, which means we cannot be confident we know what it is.
 *
 * 🪤 AND AN EMPTY REFERENCE SET IS NOT DELETABLE EITHER. See the body.
 */
export function documentReferenceCount(referenced: ReadonlySet<string>): number {
  let n = 0;
  for (const key of referenced) {
    if (parseVerificationKey(key).vendorProfileId !== null) n += 1;
  }
  return n;
}

export function isDeletableVerificationDoc(
  key: string,
  referenced: ReadonlySet<string>,
): boolean {
  // 🚨 AN EMPTY SET IS NOT EVIDENCE OF ANYTHING. We are standing in front of an
  // object that exists, so at least one reference SHOULD have been readable. A
  // set with nothing in it is what a broken reference reader returns, and that
  // is exactly how this page shipped — two sources, neither able to produce a
  // single key, no error raised by either. Refuse. The cost is an admin who
  // cannot tidy up; the alternative cost is a stranger's passport photo.
  // 🔴 **SET SIZE WAS THE WRONG NUMBER, AND MEASURING IT IS WHAT DISARMED THIS
  // GATE ONCE ALREADY.** A round of this branch added each table's PRIMARY KEY
  // to the reference SELECT; `collectPlainStrings` keeps every string at any
  // depth, so one ordinary `vendor_verifications` row whose five `*_r2_key`
  // columns were all NULL yielded a set of size 1 — its own UUID — and this
  // gate, whose entire job is to catch "the reference reader collected
  // nothing", could never fire again. Measured: branch keyCount=1
  // gateFires=false govDeletable=TRUE; the same row without the PK gave
  // keyCount=0 gateFires=true.
  // 🔑 A SET CAN BE NON-EMPTY FOR REASONS THAT PROTECT NOTHING. Count what the
  // gate MEANS — references that are shaped like a document in this bucket —
  // so no unrelated column can inflate it. Counting fewer things only ever
  // refuses a delete, which is the safe direction on this page.
  if (documentReferenceCount(referenced) === 0) return false;
  if (referenced.has(key)) return false;
  const { vendorProfileId } = parseVerificationKey(key);
  return vendorProfileId !== null;
}

/**
 * The delete action's whole decision, in one callable rule.
 *
 * `'ok'` means: go ahead. Anything else is the query-string key the page uses to
 * say what happened, and NOTHING is deleted.
 *
 * 🛡 Same reason as the two rules below it: the action is a `'use server'`
 * module a `node:test` cannot load, so a decision left inside it can only be
 * guarded by matching its text. Keep the decision here.
 *
 * ⚖ A reference read that stopped early is refused for the same reason a failed
 * one is: the danger on this page is a reference set that is SMALLER than the
 * truth, and both produce exactly that.
 */
export function verificationDeleteVerdict(input: {
  key: string;
  referenced: ReadonlySet<string>;
  referenceError: string | null;
  referencesComplete: boolean;
}): 'ok' | 'refs' | 'inuse' {
  if (input.referenceError !== null) return 'refs';
  if (!input.referencesComplete) return 'refs';
  return isDeletableVerificationDoc(input.key, input.referenced) ? 'ok' : 'inuse';
}

/** What the page renders, and the only thing that decides whether it offers a delete. */
export type VerificationDocsReport = {
  docs: VerificationDoc[];
  /** Every gate passed. Deletion is refused when false. */
  referencesComplete: boolean;
  /** Why deletion is refused, for the page to show verbatim. */
  referenceError: string | null;
  /** The bucket could not be listed at all. */
  listingError: string | null;
  /** The LISTING was short. Informational — see the note in the block reason. */
  truncated: boolean;
};

/** Why a reference read that stopped early cannot authorise anything. */
export const REFERENCES_INCOMPLETE_REASON =
  'the list of what is still in use could not be read all the way to the end, and a short list of references makes MORE files look unused, not fewer';

/** Why a listing that failed cannot authorise anything either. */
export const LISTING_FAILED_REASON =
  'storage could not be read, so nothing on this page can be checked against what is really there';

/**
 * The one decision: may this page offer a delete at all, and if not, why?
 *
 * 🛡 **THIS LIVES IN THE PURE MODULE FOR THE SAME REASON THE FOLD ABOVE
 * DOES.** It used to be one line in `verification-docs-server.ts`, guarded by a
 * test that asserted two literals appeared in that file's text. A reviewer
 * replaced `referenceError ?? (emptyWhileFilesExist ? … : null)` with
 * `referenceError`, left `emptyWhileFilesExist` computed and unused, kept both
 * asserted literals in place — and the suite reported `# tests 32 # fail 0`
 * with the gate gone.
 *
 * The gates, in the order they are checked. Every one fails CLOSED:
 *  1. A reference read that RAISED. The old trap: an empty set from a refused
 *     query is byte-identical to "nothing points at this".
 *  2. A reference read that SUCCEEDED but stopped early. New — see
 *     `readAllPages`. No error exists for gate 1 to trip on.
 *  3. A listing that failed. We cannot check a file we could not see.
 *  4. **An empty reference set while the bucket holds files.** This is the
 *     state the page shipped in: two reads that succeeded and produced nothing
 *     at all. That is what a broken reference reader looks like, not what a
 *     tidy bucket looks like, and there is no error for gate 1 either.
 *
 * ⚖ A SHORT LISTING IS DELIBERATELY NOT A GATE, and that asymmetry is the whole
 * point. Fewer objects listed = fewer deletions offered; every file still shown
 * is still checked against the full reference set. (`/admin/website-media`
 * blocks on ITS truncation because its verdict is per-FOLDER; this page's
 * verdict is per-FILE.) The page says a short listing is partial, and that is
 * the correct weight for it.
 */
export function verificationDeletionBlockReason(input: {
  referenceError: string | null;
  referencesComplete: boolean;
  /**
   * How many collected references are shaped like a document in THIS bucket —
   * NOT the size of the set. See `documentReferenceCount`: a set can be
   * non-empty for reasons that protect nothing, and measuring set size is what
   * disarmed this gate once already.
   */
  documentReferenceCount: number;
  listingError: string | null;
  objectCount: number;
}): string | null {
  if (input.referenceError !== null) return input.referenceError;
  if (!input.referencesComplete) return REFERENCES_INCOMPLETE_REASON;
  if (input.listingError !== null) return LISTING_FAILED_REASON;
  if (input.documentReferenceCount === 0 && input.objectCount > 0) return EMPTY_REFERENCE_SET_REASON;
  return null;
}

/**
 * Build the whole report from what was read. Pure, so it can be called by a
 * test rather than described to one.
 */
export function buildVerificationDocsReportFrom(input: {
  keys: ReadonlySet<string>;
  referenceError: string | null;
  referencesComplete: boolean;
  objects: ReadonlyArray<{ key: string; size: number; lastModified: Date | null }>;
  listingError: string | null;
  listingTruncated: boolean;
}): VerificationDocsReport {
  const blockReason = verificationDeletionBlockReason({
    referenceError: input.referenceError,
    referencesComplete: input.referencesComplete,
    documentReferenceCount: documentReferenceCount(input.keys),
    listingError: input.listingError,
    objectCount: input.objects.length,
  });
  return {
    docs: classifyVerificationDocs(input.objects, input.keys).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    referencesComplete: blockReason === null,
    referenceError: blockReason,
    listingError: input.listingError,
    truncated: input.listingTruncated,
  };
}

/** Human bytes, matching the website-media page's phrasing. */
export function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
