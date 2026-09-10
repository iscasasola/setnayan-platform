/**
 * cleanup-delete-scope.ts — THE ONE QUESTION EVERY CLEANUP DELETE MUST ASK:
 * "does this object belong to THIS row?"
 *
 * Pure, client-safe (NO `server-only`, NO SDK, NO I/O) so the rule is a real
 * unit test, not a source scan. The executing half is `lib/cleanup-delete.ts`.
 *
 * ─── THE CLASS THIS CLOSES ─────────────────────────────────────────────────
 * "THE ROW IS YOURS, THE FIELD IS NOT" + AN UNPINNED SERVICE-ROLE DELETE.
 *
 * A non-admin writes a string into a column of a row they own — a Papic photo's
 * `r2_object_key`, a supplier capture's key, a verification application's
 * `doc_uploads`, a site's music ref. Later a cleanup job running with the ADMIN
 * client (a retention sweep, the "remove for good" sweep, an erasure) reads that
 * string back and deletes whatever object it names. Nothing asked whether the
 * object was the row's own, so the row's owner could name ANY object in ANY of
 * the five buckets: another couple's photographs, a supplier's government ID,
 * a seven-year business permit. The buckets are not versioned; the delete is
 * permanent.
 *
 * PR #5401 closed one instance (the `vendor_verifications` columns). A review
 * that executed every claim found the same shape in the Papic full-resolution
 * sweep (switched ON, no admin step), the verification-application sweep and
 * the event-removal sweep, and the same missing question in face-data retention,
 * the story sweep and erasure. Fixing them one at a time is how the next one is
 * missed, so the answer lives here ONCE.
 *
 * ─── THE RULE ──────────────────────────────────────────────────────────────
 * A cleanup job may delete an object only when its ref names:
 *   1. a bucket that row's data legitimately lives in, AND
 *   2. a key under THAT ROW'S OWN TENANT FOLDER — its event, its guest, its
 *      supplier-and-event, its vendor, its thread, its samahan, its user.
 *
 * The tenant half matters as much as the bucket half. `setnayan-media` holds
 * every couple's photographs AND every supplier's logo; pinning a Papic sweep to
 * "the media bucket" still lets one couple delete another couple's pictures.
 *
 * ─── HOW IT IS ENFORCED, NOT JUST STATED ───────────────────────────────────
 * • A `CleanupScope` can only be minted by the builders in this file, and
 *   `planCleanupDelete` checks that AT RUNTIME by identity (a module-private
 *   WeakSet), so a hand-built `{ policies: [...] } as CleanupScope` — or a
 *   spread copy of a real scope with a wider policy list — is refused.
 * • A `PlannedDelete` is likewise only minted here, and the executor refuses
 *   anything else — so the only road to an R2 delete runs through this check.
 * • The key test reuses `parseClientRef` (lib/r2-client-ref.ts), the SEC-1 gate:
 *   strict `r2://` parse, known bucket, no `.`/`..` segments, no control
 *   characters, and every prefix ends in `/` so `event-1/` never matches
 *   `event-12/…`.
 * • `lib/every-cleanup-delete-is-pinned.test.ts` derives every caller of a raw
 *   delete primitive from the source tree and fails if a new one appears
 *   outside the executor and a reasoned, exact exemption list.
 *
 * 🔒 FAILS CLOSED, in the direction that KEEPS the file. A refusal is returned as
 * data; the caller must COUNT it and must NOT null the pointer it refused — a
 * cleared pointer to an object we kept leaves that object retained with nothing
 * left to say whose it is.
 *
 * ⚠ A LEGACY PUBLIC URL (`https://…`) IS ALWAYS REFUSED. Its tenancy cannot be
 * proven without the deploy's public-host setting, and `deletePublicAsset`
 * would also have followed it into Supabase storage. Measured 2026-09-10: no
 * column any of these jobs reads holds a legacy URL in production.
 */
import type { R2BucketName } from '@/lib/r2';
import {
  guestSelfiePolicy,
  paperworkScanPolicy,
  parseClientRef,
  stdSealedPolicy,
  vendorOwnedMediaPolicy,
  vendorVerificationDocPolicy,
  type ClientRefPolicy,
} from '@/lib/r2-client-ref';

/**
 * Type-level brands (erased at runtime) so a plain object literal does not
 * type-check as a scope or a target…
 */
declare const SCOPE_BRAND: unique symbol;
declare const PLANNED_BRAND: unique symbol;

/**
 * …and the RUNTIME proof: identity membership in module-private sets. A brand
 * carried as a property would survive `{ ...scope, policies: [wider] }` (object
 * spread copies own enumerable symbol keys); a WeakSet entry does not — the
 * spread is a new object this module never minted.
 */
const MINTED_SCOPES = new WeakSet<object>();
const MINTED_TARGETS = new WeakSet<object>();

const MEDIA: R2BucketName = 'setnayan-media';
const THREAD_FILES: R2BucketName = 'setnayan-thread-files';
const VENDOR_VERIFICATION: R2BucketName = 'setnayan-vendor-verification';

/**
 * Where one row's objects may live. Minted ONLY by the builders below.
 *
 * `bareKeysIn` — some Papic rows predate the `r2://` scheme and store a bare
 * object key, which the Papic resolver has always read as the media bucket.
 * Only the Papic scopes accept one, and a bare key is held to the SAME tenant
 * prefix as a tagged one.
 */
export type CleanupScope = {
  readonly label: string;
  readonly policies: readonly ClientRefPolicy[];
  readonly bareKeysIn: R2BucketName | null;
  readonly [SCOPE_BRAND]: true;
};

/** One object a cleanup job has PROVEN it may delete. Minted only by `planCleanupDelete`. */
export type PlannedDelete = {
  readonly bucket: R2BucketName;
  readonly key: string;
  /** The scope label that admitted it — for logs, never a ref. */
  readonly scope: string;
  readonly [PLANNED_BRAND]: true;
};

export type CleanupDecision =
  | { readonly ok: true; readonly target: PlannedDelete }
  | { readonly ok: false; readonly reason: 'empty' | 'out_of_scope' | 'invalid_scope' };

/**
 * An id that is safe to put inside a key prefix. Row ids here are uuids or short
 * slugs in fixtures; anything carrying a `/`, a dot segment or whitespace could
 * widen the prefix it is interpolated into (`events//` or `events/../`), so it
 * yields a scope that admits NOTHING rather than one that admits too much.
 */
function safeId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const t = id.trim();
  if (t.length === 0 || t.length > 128) return null;
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(t) ? t : null;
}

function mintScope(
  label: string,
  policies: readonly ClientRefPolicy[],
  bareKeysIn: R2BucketName | null = null,
): CleanupScope {
  const scope = Object.freeze({
    label,
    policies: Object.freeze(policies.map((p) => Object.freeze({ ...p, prefixes: Object.freeze([...p.prefixes]) }))),
    bareKeysIn,
  }) as unknown as CleanupScope;
  MINTED_SCOPES.add(scope);
  return scope;
}

/** A scope that admits nothing — what a builder returns for an unusable id. */
function emptyScope(label: string): CleanupScope {
  return mintScope(`${label}:no-tenant`, []);
}

/** The Papic key layouts carry the original under `X/` and its derivatives under `derivatives/X/`. */
function papicFolder(folder: string): ClientRefPolicy {
  return { bucket: MEDIA, prefixes: [folder, `derivatives/${folder}`] };
}

// ─── Builders — one per kind of row. EVERY id passed must come from the row
//     being cleaned up (read by the job itself), never from a caller's input. ──

/**
 * `papic_photos` — every seat camera, the host's own uploads camera and the
 * dashboard's add-to-library. `/api/upload`'s seat branch mints the key
 * server-side as `papic/event-<event_id>/seat-<seat_id>/…`; derivatives land at
 * `derivatives/<that key>.…avif`. Measured in production 2026-09-10: all 14
 * rows, every original, display, thumb, tile, poster and web copy, sit under
 * their own event's folder.
 *
 * Pinned to the EVENT, not the seat: a couple may legitimately re-point a
 * photo's seat, and the event is the tenancy a stranger cannot reach.
 */
export function papicSeatCaptureScope(eventId: unknown): CleanupScope {
  const e = safeId(eventId);
  if (!e) return emptyScope('papic_photos');
  return mintScope(`papic_photos:${e}`, [papicFolder(`papic/event-${e}/`)], MEDIA);
}

/**
 * `papic_guest_captures` — `/api/papic/guest-capture` mints
 * `papic/guest/<guest_id>/papic-<stamp>.jpg` (and `-poster.jpg`, `-web.mp4`).
 * The guest belongs to exactly one event, so the guest IS the tenant.
 */
export function papicGuestCaptureScope(guestId: unknown): CleanupScope {
  const g = safeId(guestId);
  if (!g) return emptyScope('papic_guest_captures');
  return mintScope(`papic_guest_captures:${g}`, [papicFolder(`papic/guest/${g}/`)], MEDIA);
}

/**
 * `vendor_papic_captures` — `/api/vendor/papic-capture` mints
 * `papic/vendor-<vendor_profile_id>/event-<event_id>/cap-<stamp>…`. Both ids
 * are the tenant: a supplier's capture at one celebration may not name its
 * capture at another, nor another supplier's.
 */
export function papicVendorCaptureScope(vendorProfileId: unknown, eventId: unknown): CleanupScope {
  const v = safeId(vendorProfileId);
  const e = safeId(eventId);
  if (!v || !e) return emptyScope('vendor_papic_captures');
  return mintScope(
    `vendor_papic_captures:${v}:${e}`,
    [papicFolder(`papic/vendor-${v}/event-${e}/`)],
    MEDIA,
  );
}

/**
 * An event's own website media on the `events` row — hero image and film, site
 * music, the delivered Pakanta song, `our_photos`. Every writer files under
 * `events/<event_id>/` (site music, Pakanta `events/<id>/pakanta-song/`, the
 * site-chrome and Save-the-Date actions via `eventMediaPolicy`).
 */
export function eventSiteMediaScope(eventId: unknown): CleanupScope {
  const e = safeId(eventId);
  if (!e) return emptyScope('events');
  return mintScope(`events:${e}`, [{ bucket: MEDIA, prefixes: [`events/${e}/`] }]);
}

/** A guest's enrolled selfie — both writers gate it with `guestSelfiePolicy`. */
export function guestSelfieScope(eventId: unknown, guestId: unknown): CleanupScope {
  const e = safeId(eventId);
  const g = safeId(guestId);
  if (!e || !g) return emptyScope('guest_face_enrollments');
  return mintScope(`guest_face_enrollments:${e}:${g}`, [guestSelfiePolicy(e, g)]);
}

/**
 * `vendor_verification_applications.doc_uploads` — the live intake accepts a
 * slot ref under EITHER `vendorVerificationDocPolicy` (private bucket,
 * `vendors/<id>/verification/`) OR `vendorOwnedMediaPolicy` (public media,
 * `vendors/<id>/`). Both are pinned to the vendor's OWN folder, which is the
 * part #5401's docblock claimed the database enforced and it did not.
 */
export function vendorIdentityUploadScope(vendorProfileId: unknown): CleanupScope {
  const v = safeId(vendorProfileId);
  if (!v) return emptyScope('vendor_verification_applications');
  return mintScope(`vendor_verification_applications:${v}`, [
    vendorVerificationDocPolicy(v),
    vendorOwnedMediaPolicy(v),
  ]);
}

/**
 * `vendor_verifications` identity key columns — service_role-only since
 * migration 20271218766967 and written by nothing in the repo today. Held to
 * the private bucket AND the vendor's own folder there.
 */
export function vendorVerificationRecordScope(vendorProfileId: unknown): CleanupScope {
  const v = safeId(vendorProfileId);
  if (!v) return emptyScope('vendor_verifications');
  return mintScope(`vendor_verifications:${v}`, [
    { bucket: VENDOR_VERIFICATION, prefixes: [`vendors/${v}/`] },
  ]);
}

/** A samahan story — `/api/samahan/story` mints `samahan/<community_id>/story-<stamp>…`. */
export function samahanStoryScope(communityId: unknown): CleanupScope {
  const c = safeId(communityId);
  if (!c) return emptyScope('samahan_stories');
  return mintScope(`samahan_stories:${c}`, [{ bucket: MEDIA, prefixes: [`samahan/${c}/`] }]);
}

/** A superseded Save-the-Date seal — service-role written under `events/<id>/std-screened/`. */
export function stdSealedScope(eventId: unknown): CleanupScope {
  const e = safeId(eventId);
  if (!e) return emptyScope('std_sealed');
  return mintScope(`std_sealed:${e}`, [stdSealedPolicy(e)]);
}

/** A civil-registry scan on `event_paperwork` — `paperworkScanPolicy`. */
export function paperworkScope(eventId: unknown): CleanupScope {
  const e = safeId(eventId);
  if (!e) return emptyScope('event_paperwork');
  return mintScope(`event_paperwork:${e}`, [paperworkScanPolicy(e)]);
}

/** A chat attachment — `lib/chat-send.ts` files it under `chat/<thread_id>/` in thread-files. */
export function chatAttachmentScope(threadId: unknown): CleanupScope {
  const t = safeId(threadId);
  if (!t) return emptyScope('chat_messages');
  return mintScope(`chat_messages:${t}`, [{ bucket: THREAD_FILES, prefixes: [`chat/${t}/`] }]);
}

/** A person's profile photo — `profile-photo/<user_id>/…` in media. */
export function profilePhotoScope(userId: unknown): CleanupScope {
  const u = safeId(userId);
  if (!u) return emptyScope('users');
  return mintScope(`users:${u}`, [{ bucket: MEDIA, prefixes: [`profile-photo/${u}/`] }]);
}

/** A shop's logo — `vendors/<vendor_profile_id>/logo/…` in media. */
export function vendorLogoScope(vendorProfileId: unknown): CleanupScope {
  const v = safeId(vendorProfileId);
  if (!v) return emptyScope('vendor_profiles');
  return mintScope(`vendor_profiles:${v}`, [vendorOwnedMediaPolicy(v)]);
}

// ─── The check ──────────────────────────────────────────────────────────────

export function isCleanupScope(value: unknown): value is CleanupScope {
  return typeof value === 'object' && value !== null && MINTED_SCOPES.has(value);
}

export function isPlannedDelete(value: unknown): value is PlannedDelete {
  return typeof value === 'object' && value !== null && MINTED_TARGETS.has(value);
}

/**
 * MAY A CLEANUP JOB DELETE THE OBJECT `ref` NAMES, ON BEHALF OF THE ROW `scope`
 * WAS BUILT FROM?
 *
 * Returns the proven `{ bucket, key }` as a `PlannedDelete`, or a refusal. Never
 * throws for bad input. A scope that did not come from a builder in this file
 * is `invalid_scope` — refused, because the whole point is that nobody hands
 * this function a wider rule than the row earns.
 */
export function planCleanupDelete(ref: unknown, scope: CleanupScope): CleanupDecision {
  if (!isCleanupScope(scope)) return { ok: false, reason: 'invalid_scope' };
  if (typeof ref !== 'string' || ref.trim().length === 0) return { ok: false, reason: 'empty' };
  const trimmed = ref.trim();

  let candidate = trimmed;
  if (!trimmed.startsWith('r2://')) {
    // A bare object key is only meaningful where the row's own reader has always
    // resolved one (Papic → media). A URL, or anything scheme-shaped, is never a
    // bare key — its tenancy cannot be proven, so it is not ours to delete.
    if (!scope.bareKeysIn || trimmed.includes('://') || trimmed.startsWith('/')) {
      return { ok: false, reason: 'out_of_scope' };
    }
    candidate = `r2://${scope.bareKeysIn}/${trimmed}`;
  }

  for (const policy of scope.policies) {
    const parsed = parseClientRef(candidate, policy);
    if (parsed) {
      const target = Object.freeze({
        bucket: parsed.bucket,
        key: parsed.key,
        scope: scope.label,
      }) as unknown as PlannedDelete;
      MINTED_TARGETS.add(target);
      return { ok: true, target };
    }
  }
  return { ok: false, reason: 'out_of_scope' };
}

/** Convenience: does `ref` belong to the row `scope` describes? */
export function refBelongsToRow(ref: unknown, scope: CleanupScope): boolean {
  return planCleanupDelete(ref, scope).ok;
}

// ─── The executor, bound to its raw delete ─────────────────────────────────
//
// The executing half lives HERE, parameterised by the raw delete, so the rule
// "only a planner-minted target reaches storage" is a unit test with a fake
// deleter rather than a source scan. `lib/cleanup-delete.ts` binds it to
// `r2Delete` and is the ONLY file that does (the caller scan in
// every-cleanup-delete-is-pinned.test.ts refuses any other file naming r2Delete).

/** The raw storage delete an executor is bound to — `r2Delete` in production. */
export type RawObjectDelete = (args: { bucket: R2BucketName; key: string }) => Promise<unknown>;

export type CleanupExecutor = {
  /**
   * Delete one object that `planCleanupDelete` already proved. Refuses anything
   * else — a `{ bucket, key }` built by hand, or a spread copy of a real target,
   * is not a proof — by THROWING before the raw delete is reached.
   */
  executeCleanupDelete(target: PlannedDelete): Promise<void>;
  /**
   * Plan + execute in one call. Returns `'refused'` — as DATA, never thrown —
   * when the ref is not the row's own; the caller must count that and must not
   * clear the pointer it refused. Throws only when an in-scope delete fails.
   */
  cleanupDelete(ref: unknown, scope: CleanupScope): Promise<'deleted' | 'refused'>;
};

export function bindCleanupExecutor(rawDelete: RawObjectDelete): CleanupExecutor {
  const executeCleanupDelete = async (target: PlannedDelete): Promise<void> => {
    if (!isPlannedDelete(target)) {
      throw new Error('executeCleanupDelete: refused an unplanned delete target');
    }
    await rawDelete({ bucket: target.bucket, key: target.key });
  };
  const cleanupDelete = async (ref: unknown, scope: CleanupScope): Promise<'deleted' | 'refused'> => {
    const decision = planCleanupDelete(ref, scope);
    if (!decision.ok) return 'refused';
    await executeCleanupDelete(decision.target);
    return 'deleted';
  };
  return { executeCleanupDelete, cleanupDelete };
}

/** Thrown by adapters that must surface a refusal as an error (erasure audits it). */
export class CleanupDeleteRefused extends Error {
  constructor(
    readonly scopeLabel: string,
    readonly reason: 'empty' | 'out_of_scope' | 'invalid_scope',
  ) {
    // Deliberately carries no ref: audit rows must not become a second copy of a
    // storage key, and the refusal's value is that it happened, not what it named.
    super(`cleanup delete refused (${reason}) — the object is not this row's own [${scopeLabel}]`);
    this.name = 'CleanupDeleteRefused';
  }
}
