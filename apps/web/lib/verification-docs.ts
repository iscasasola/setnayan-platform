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
export function collectPlainStrings(raw: unknown, maxDepth = 8): string[] {
  const found = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > maxDepth || value === null || value === undefined) return;
    if (typeof value === 'string') {
      // 🚨 THE EXCLUSION IS COMPUTED ON THE **RAW** STRING, ON PURPOSE, AND
      // MUST STAY THAT WAY. `collectStoredAssetRefs` — the other half — decides
      // what it owns with `value.startsWith('r2://')` on the raw string. This
      // half used to exclude on `value.trim().startsWith('r2://')`, which is a
      // WIDER test than the one that includes, so the gap between them was a
      // hole neither half covered: measured, `" r2://<bucket>/<key>"` with ONE
      // leading space came back half1=0 half2=0, landed in no set at all, and
      // the government ID it names was classified `left_over` with Delete
      // beside it. `\n` and `\t` behaved identically; a TRAILING space was
      // always fine.
      // 🔑 TWO PREDICATES THAT DIVIDE ONE JOB MUST BE COMPUTED ON THE SAME
      // STRING. Whichever way they disagree, one side is a silent hole.
      if (value.startsWith('r2://')) return;
      const t = value.trim();
      // Leaving genuine refs to the other half is what makes both halves
      // load-bearing: gut either one and a shape stops being found.
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
  return [...found];
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
export function referencedKeysFrom(raw: unknown): string[] {
  const out = new Set<string>();
  const candidates = new Set<string>([
    // Half one: every `r2://` ref, at any depth. The erasure sweep's own walk.
    ...collectStoredAssetRefs(raw),
    // Half two: everything that walk cannot see — a bare key, a legacy URL, or
    // any shape nobody has written yet.
    ...collectPlainStrings(raw),
  ]);
  for (const candidate of candidates) {
    for (const form of referenceCandidateForms(candidate)) out.add(form);
  }
  return [...out];
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

  // 4 · a legacy http(s) URL. `URL` throws on anything that is not one, which
  // is the cheapest way to ask "is this a URL" without a regex that guesses.
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
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
export function collectReferencedKeys(sources: Iterable<unknown>): Set<string> {
  const keys = new Set<string>();
  for (const source of sources) {
    for (const key of referencedKeysFrom(source)) keys.add(key);
  }
  return keys;
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
 * ⛔ Raising a limit is the same bug with a bigger number. This pages to
 * exhaustion and ASSERTS it got there: a page that comes back exactly full is
 * never the end — the next page is fetched, and only a SHORT page proves the
 * end. If the ceiling is reached first, `complete` is false and the caller must
 * fail closed.
 *
 * `fetchPage` is injected so this is testable by behaviour rather than by
 * reading the server module's source.
 */
export async function readAllPages(
  fetchPage: (from: number, to: number) => Promise<{ rows: unknown[] | null; error: string | null }>,
  opts?: { pageSize?: number; maxPages?: number },
): Promise<{ rows: unknown[]; error: string | null; complete: boolean }> {
  const pageSize = Math.max(1, opts?.pageSize ?? 500);
  const maxPages = Math.max(1, opts?.maxPages ?? 200);
  const rows: unknown[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { rows: got, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error, complete: false };
    const batch = got ?? [];
    rows.push(...batch);
    // A SHORT page is the only proof of the end. An exactly-full page is what a
    // cap looks like, so it is never treated as the end.
    if (batch.length < pageSize) return { rows, error: null, complete: true };
  }

  return { rows, error: null, complete: false };
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
  if (referenced.size === 0) return false;
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
  referenceKeyCount: number;
  listingError: string | null;
  objectCount: number;
}): string | null {
  if (input.referenceError !== null) return input.referenceError;
  if (!input.referencesComplete) return REFERENCES_INCOMPLETE_REASON;
  if (input.listingError !== null) return LISTING_FAILED_REASON;
  if (input.referenceKeyCount === 0 && input.objectCount > 0) return EMPTY_REFERENCE_SET_REASON;
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
    referenceKeyCount: input.keys.size,
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
