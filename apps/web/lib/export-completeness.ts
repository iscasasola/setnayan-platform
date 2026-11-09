/**
 * export-completeness.ts — the registry that decides, per table, whether a
 * person's own rows are part of their RA 10173 § 16(c) access request.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `/privacy` grants the right without qualification: "download a JSON archive
 * of your data anytime (served by our /api/profile/export endpoint)."
 *
 * That route is careful about what it READ and could not read — `listOutcome`,
 * `not_included`, `export_complete`, and a ban on `?? []` so a failed read can
 * never render as "you have none". 🔑 **But a table the route never QUERIES is
 * absent from `not_included` too.** It is not reported as missing; it is
 * outside the universe the route knows about. Careful accounting of a set that
 * is itself incomplete still reports completeness.
 *
 * Measured against production on 2026-09-15 by diffing the tables the route
 * reads against every `public` base table carrying a person-key column, seven
 * with live rows were in neither list — `receipts` (4 rows), `notifications`
 * (72), `user_devices` (32), `social_posts` (103), `order_ledger` (9),
 * `event_moderators` (6), `creator_chapters` (1).
 *
 * ⚠ **AND NOT ALL OF THEM BELONG IN AN EXPORT.** `admin_audit_log` records what
 * an ADMIN did; `community_invite_tokens` are credentials. The defect was never
 * "seven tables are missing" — it was that **nobody had decided, and there was
 * nowhere to write the decision down.** This file is that place. Every
 * person-keyed table is EXPORTED or EXCLUDED, and an exclusion carries a reason
 * a person can disagree with.
 *
 * `every-person-keyed-table-is-decided.db.test.ts` replays the full schema and
 * fails on any table in neither list, so a table added next month forces the
 * decision instead of inheriting silence.
 */

/** Columns that mean "this row is about a particular person". */
export const PERSON_KEY_COLUMNS = [
  'user_id',
  'author_user_id',
  'owner_user_id',
  'created_by',
  'actor_user_id',
] as const;

export type ExportDecision =
  | { table: string; decision: 'exported'; as: string }
  | { table: string; decision: 'excluded'; why: string };

/**
 * ⚖ EXCLUSIONS — each is a judgement, not an oversight. Disagree with one and
 * change it; do not add an entry you could not defend to the person whose
 * access request it narrows.
 */
export const EXPORT_DECISIONS: ReadonlyArray<ExportDecision> = [
  // ── The subject's own records ───────────────────────────────────────────
  { table: 'users', decision: 'exported', as: 'profile (users)' },
  { table: 'event_members', decision: 'exported', as: 'event_memberships' },
  // Two sections: what they wrote, and (RA 10173, Build 3 lane B round 3) the private lines sent TO them.
  { table: 'chat_messages', decision: 'exported', as: 'chat_messages_authored · chat_private_messages_received' },
  { table: 'orders', decision: 'exported', as: 'orders' },
  { table: 'payments', decision: 'exported', as: 'payments' },
  // 📱 A crew member's own passes onto a shop's Event Hub (2026-10-29) — the name they typed, their role, whether
  // they were let in. Read on `crew_user_id`.
  { table: 'vendor_crew_passes', decision: 'exported', as: 'crew_passes' },
  // ♥ The hearts this subject put on chat messages (THE ONE BUILD, 2026-11-08) — read on `user_id`.
  { table: 'chat_message_hearts', decision: 'exported', as: 'chat_message_hearts' },
  {
    table: 'vendor_crew_codes',
    decision: 'excluded',
    why: 'A shop’s crew QR for one event — a bearer credential (whoever holds the token can ask to join), keyed by `created_by` only as the issuing admin’s stamp. The admin’s act is the SHOP’s record; exporting the live token would hand out a working door.',
  },
  { table: 'guest_face_enrollments', decision: 'exported', as: 'face_enrollments' },
  // A guest's "I sent it" (E-Gifts wish list, 2026-10-08) — keyed to a guest, like
  // the face records; scoped to the subject's own guest ids.
  { table: 'event_gift_records', decision: 'exported', as: 'gifts_you_said_you_sent' },
  // When a guest last opened the Event Hub with their own pass (Who's here, 2026-10-29) — keyed to a guest, scoped
  // to the subject's own guest ids. Strangers' counts (hub_visitor_buckets) hold no person at all.
  { table: 'hub_guest_views', decision: 'exported', as: 'event_hub_opens' },
  { table: 'dependents', decision: 'exported', as: 'alaga_dependents' },
  { table: 'godparents', decision: 'exported', as: 'alaga_godparents' },
  { table: 'community_members', decision: 'exported', as: 'samahan_memberships' },
  { table: 'samahan_stories', decision: 'exported', as: 'samahan_stories' },
  { table: 'samahan_messages', decision: 'exported', as: 'samahan_messages' },
  { table: 'samahan_reads', decision: 'exported', as: 'samahan_memberships' },
  { table: 'vendor_profiles', decision: 'exported', as: 'vendor_profile' },
  { table: 'papic_free_grant_claims', decision: 'exported', as: 'papic_free_grant' },
  { table: 'event_deletion_requests', decision: 'exported', as: 'event_deletion_requests' },
  // "Don't show me invites from this person" (owner 2026-09-28, migration
  // 20271252896804) — the subject's own private mute list, keyed on user_id.
  { table: 'invite_mutes', decision: 'exported', as: 'invite_mutes' },
  // 🖼⏱ The Mood Board photo changes the subject MADE under Mood Board Edit (2026-10-30, migration 20271299051148) —
  // author-scoped on actor_user_id, like event_colour_changes.
  { table: 'event_mood_board_changes', decision: 'exported', as: 'mood_board_changes_made' },
  { table: 'event_type_requests', decision: 'exported', as: 'event_type_requests' },

  // ── Sorted off the undecided backlog, 2026-11-05 ────────────────────────
  // Owner, on "Download my data is missing about 39 kinds of record": "this is
  // important" (DECISION_LOG 2026-11-05, the 15 "act first" items, item 7). The
  // rule applied is the one this file and /privacy already state: the person
  // gets THEIR OWN personal data — every read is filtered on the subject's own
  // id, and other people's ids, staff notes and credentials stay out.
  //
  // Already read by lib/personal-data-export.ts before this sort, but never
  // written down here — so the registry said "undecided" about a table the file
  // already carried.
  { table: 'event_vendor_working_notes', decision: 'exported', as: 'vendor_working_notes_authored' },
  { table: 'event_day_requests', decision: 'exported', as: 'day_requests_authored' },
  { table: 'event_clusters', decision: 'exported', as: 'years_you_grouped' },
  { table: 'event_colour_grants_coordinator', decision: 'exported', as: 'own_colour_access_held' },
  { table: 'event_colour_changes', decision: 'exported', as: 'own_colour_changes_made' },
  // Read by the SHOP (vendor_profile_id), not by `created_by`: the photos are the
  // shop's portfolio, and they reach the shop owner's file. A staffer who
  // uploaded for the shop is stamped, not the owner of the photo.
  { table: 'editorial_vendor_media', decision: 'exported', as: 'vendor_submitted_media' },
  // Newly read on 2026-11-05.
  { table: 'notifications', decision: 'exported', as: 'notifications_received' },
  { table: 'receipts', decision: 'exported', as: 'receipts' },
  { table: 'order_ledger', decision: 'exported', as: 'order_history' },
  { table: 'account_deletion_requests', decision: 'exported', as: 'account_deletion_requests' },
  { table: 'chat_thread_reads', decision: 'exported', as: 'chat_read_markers' },
  { table: 'comp_grants', decision: 'exported', as: 'comps_given_to_you' },
  { table: 'couple_event_type_notify_signups', decision: 'exported', as: 'notify_me_signups' },
  { table: 'couple_wedding_type_notify_signups', decision: 'exported', as: 'notify_me_signups' },
  { table: 'creator_chapters', decision: 'exported', as: 'creator_chapters' },
  { table: 'discount_code_eligible_users', decision: 'exported', as: 'vouchers_you_were_offered' },
  { table: 'event_moderators', decision: 'exported', as: 'cohost_roles' },
  { table: 'event_preparation_items', decision: 'exported', as: 'prep_items_added' },
  { table: 'budget_builds', decision: 'exported', as: 'budget_builds_made' },
  { table: 'event_stage_notes', decision: 'exported', as: 'stage_notes_sent' },
  { table: 'founder_seats', decision: 'exported', as: 'founder_seat' },
  { table: 'guest_saved_vendors', decision: 'exported', as: 'saved_suppliers' },
  { table: 'help_messages', decision: 'exported', as: 'help_messages_sent' },
  { table: 'referral_codes', decision: 'exported', as: 'referral_codes' },
  { table: 'service_slot_reservations', decision: 'exported', as: 'reservations_made' },
  { table: 'user_face_profiles', decision: 'exported', as: 'face_profile' },
  { table: 'vendor_date_waitlist', decision: 'exported', as: 'date_waitlists_joined' },
  { table: 'vendor_member_token_wallets', decision: 'exported', as: 'retired_token_balances' },
  { table: 'vendor_team_members', decision: 'exported', as: 'supplier_team_memberships' },
  // Added 2026-11-06 with the table (supplier claim scanner, slice 1): read by scanned_by_user_id, guest not selected.
  { table: 'supplier_scan_claims', decision: 'exported', as: 'supplier_scans_made' },
  // Added 2026-11-09 with the tables (Supplier Build 3 · lane B): host seats in a supplier chat, read by user_id with
  // the subject's own left_note (added_by_user_id not selected), and the per-person blocker show counts.
  { table: 'chat_thread_members', decision: 'exported', as: 'chat_conversations_hosted' },
  { table: 'chat_blocker_shows', decision: 'exported', as: 'chat_blocker_shows' },
  // Round 2 (migration 20271332497337): a decision topic is the conversation's shared record (either side closes it,
  // anyone reopens) — the call made for communities / event_wish_items: who started it only stamps the row.
  { table: 'chat_decision_topics', decision: 'excluded', why: 'The conversation\'s shared topic (a title, open or closed), not the opener\'s record: every member of the chat reads, closes and reopens it, and opened_by / closed_by only stamp who pressed. The same call as communities.created_by. The erasure clears both stamps (lib/erasure/coverage.ts).' },

  // ── Excluded, with the reason ───────────────────────────────────────────
  {
    table: 'communities',
    decision: 'excluded',
    why:
      'The GROUP itself — its name, description and photo. `created_by` only stamps who started it; every ' +
      'member reads and may edit the row, so it is the group\'s shared record, not the founder\'s (same call as ' +
      'event_wish_items). The subject\'s own membership, with the group\'s name, is exported as samahan_memberships.',
  },
  {
    table: 'live_studio_highlights',
    decision: 'excluded',
    why:
      'A moment marked on an EVENT\'s Live Watch recording. `created_by` stamps which host or operator pressed ' +
      'the button; the row is the event\'s bookmark on its own footage, the same way an event_schedule_tasks row ' +
      'is the event\'s run of show. The subject\'s membership of that event is exported.',
  },
  {
    table: 'guest_qr_rotations',
    decision: 'excluded',
    why:
      'A record that a GUEST\'s invitation QR was replaced. `actor_user_id` is the host or admin who pressed ' +
      'rotate — an action ON another person\'s pass, not personal data of the presser — and `old_token_sha256` is ' +
      'derived from a credential. Same line as resolved_by on event_day_requests.',
  },
  {
    table: 'platform_expenses',
    decision: 'excluded',
    why:
      'Setnayan\'s own books — what the company spent, logged by staff. `created_by` is the staff member who ' +
      'typed the line; the row is not about them. Same decision as DELIBERATE_EXCLUSIONS in ' +
      'lib/export-coverage-guardrail.test.ts.',
  },
  {
    table: 'promo_free_windows',
    decision: 'excluded',
    why:
      'Platform promo configuration — a free-window announcement an admin scheduled. `created_by` is that admin; ' +
      'the row defines a promo, not a person. Same decision as the export guardrail\'s DELIBERATE_EXCLUSIONS.',
  },
  {
    table: 'social_posts',
    decision: 'excluded',
    why:
      'Setnayan\'s OWN outbound social posts, composed by staff. `created_by` is the admin who wrote the post. ' +
      'A couple whose creation was featured has that recorded in marketing_share_consents, which is exported.',
  },
  {
    table: 'event_schedule_tasks',
    decision: 'excluded',
    why:
      'A moment\'s parallel tasks on an event\'s run of show (migration 20271300072429) — "the bridesmaids\' hair, ' +
      '2F holding room". The row belongs to the EVENT\'s schedule; it is keyed to a person only by `created_by`, the ' +
      'host or coordinator who typed it, the same way a schedule block (not exported) is theirs to edit. A guest named ' +
      'on one is named by the event, not by their own act.',
  },
  {
    table: 'event_schedule_task_contacts',
    decision: 'excluded',
    why:
      'A task\'s day-of contact (migration 20271303218631) — the name and phone of someone like the bridal-car driver, ' +
      'typed by the host onto the event\'s run of show. Keyed to a person only by `created_by`, the host or coordinator ' +
      'who typed it, exactly like its parent `event_schedule_tasks` above: the row is the EVENT\'s schedule, not the ' +
      'typist\'s own record. The person it names holds no account, so there is no subject to export it to.',
  },
  {
    table: 'app_store_purchases',
    decision: 'excluded',
    why:
      'Every App Store purchase the subject made is ALREADY in their export as an ordinary ' +
      'orders row (platform ios) and payments row (channel app_store, reference = Apple\'s ' +
      'transaction id, amount = what Apple charged). This table holds the same facts plus ' +
      'the one-time token we minted for Apple to sign; it is service-role only, and the token ' +
      'is an internal key, not information about the person (migration 20271276386641).',
  },
  {
    table: 'admin_audit_log',
    decision: 'excluded',
    why:
      'Records what an ADMIN did, keyed by the admin as actor. It is the platform\'s ' +
      'accountability record, not the subject\'s personal data, and handing it out would ' +
      'disclose other people\'s moderation decisions. A subject asking what was done TO them ' +
      'is a different request, answered by a person.',
  },
  {
    table: 'community_invite_tokens',
    decision: 'excluded',
    why:
      'Credentials, not personal data. Exporting a live invite token in a file the subject ' +
      'may email to themselves turns an access request into a key disclosure.',
  },
  {
    table: 'api_keys',
    decision: 'excluded',
    why: 'Credentials. Same reason as community_invite_tokens — an export must never carry a secret.',
  },
  {
    table: 'apple_sign_in_tokens',
    decision: 'excluded',
    why: 'A sealed Sign in with Apple refresh token, held only so account erasure can revoke the grant at Apple. A credential — an export must never carry a secret.',
  },
  {
    table: 'push_subscriptions',
    decision: 'excluded',
    why:
      'Holds a browser push endpoint plus its encryption keys. The endpoint IS personal, but it ' +
      'is also a live delivery credential; exporting it lets anyone holding the file push to ' +
      'that device. Disclose that it is held; do not hand over the keys.',
  },
  {
    table: 'shop_papic_wallet_entries',
    decision: 'excluded',
    why:
      'The SHOP wallet — a business\'s Papic-credit ledger keyed to the shop (vendor_profile_id), ' +
      'not to a person (owner 2026-10-23, option A). `created_by` is an actor stamp on who pressed a ' +
      'spend or wrote an admin credit; the row says nothing about that person, the shop owner reads ' +
      'every row on Customers › Money, and erasure clears the stamp (lib/erasure/coverage.ts).',
  },
  {
    table: 'shop_gift_purchases',
    decision: 'excluded',
    why:
      'A SHOP\'s gift-stock purchase — which pack, how many, at what price — keyed to the shop ' +
      '(vendor_profile_id), not to a person (supplier gifts, 2026-11-05). `created_by` is an actor stamp on who ' +
      'pressed Buy; the row says nothing about that person, the order and payment it belongs to are exported ' +
      'with `orders` / `payments`, and erasure clears the stamp (lib/erasure/coverage.ts).',
  },
  {
    table: 'shop_gift_stock_entries',
    decision: 'excluded',
    why:
      'The SHOP\'s gift-stock ledger (bought · given · reversed), keyed to the shop like ' +
      'shop_papic_wallet_entries. `created_by` is an actor stamp on who caused the entry; the row says nothing ' +
      'about that person, the shop owner reads it on Shop › Promote › Your gifts, and erasure clears the stamp ' +
      '(lib/erasure/coverage.ts).',
  },
  {
    table: 'shop_badge_upgrades',
    decision: 'excluded',
    why:
      'The 4-week add-on upgrades a badge gave a SHOP (owner 2026-11-06) — keyed to the shop (vendor_profile_id), not to a ' +
      'person, with no person column at all. The shop owner reads every one on Shop › Promote › Your upgrades; the add-on ' +
      'window it started lives on vendor_profiles, which the export already carries.',
  },
  {
    table: 'shop_badge_rewards',
    decision: 'excluded',
    why:
      'What each badge GAVE a SHOP (badge rewards, 2026-11-05) — keyed to the shop (vendor_profile_id), not to a ' +
      'person. `revoked_by` is an admin actor stamp on who took back a free booking fee; the row says nothing about ' +
      'that person, the shop owner reads every reward on Plan › Your gifts and the badge page, and erasure clears the ' +
      'stamp (lib/erasure/coverage.ts).',
  },
  {
    table: 'hub_music_tracks',
    decision: 'excluded',
    why:
      'Setnayan\'s own music catalogue — the tracks an admin uploads for couples to pick ' +
      '(owner 2026-10-08). `created_by` is the staff account that uploaded a track, an actor ' +
      'stamp on platform content; the row says nothing about that person, and erasure clears ' +
      'the stamp (lib/erasure/coverage.ts).',
  },
];

/** Tables that must appear in the export payload, by their payload key. */
export function exportedTables(): ReadonlyArray<{ table: string; as: string }> {
  return EXPORT_DECISIONS.flatMap((d) =>
    d.decision === 'exported' ? [{ table: d.table, as: d.as }] : [],
  );
}

/** Tables deliberately left out, with the reason a reader can argue with. */
export function excludedTables(): ReadonlyArray<{ table: string; why: string }> {
  return EXPORT_DECISIONS.flatMap((d) =>
    d.decision === 'excluded' ? [{ table: d.table, why: d.why }] : [],
  );
}

/**
 * ⏳ UNDECIDED — the honest third state, and a RATCHET.
 *
 * Measured 2026-09-15 by replaying the full schema: these tables carry a
 * person-key column and nobody has yet decided whether a subject's own rows
 * belong in their export. Listing them is not approval — it is the difference
 * between a backlog somebody can work and a gap nobody can see.
 *
 * 🔒 THE GUARD ASSERTS THIS LIST ONLY SHRINKS. A NEW person-keyed table may not
 * join it: a table added next month must be decided when it is added, while the
 * person who added it still knows what it holds. That is the one moment the
 * decision is cheap.
 *
 * ⚠ Several of these are genuinely the OWNER's call, not engineering's — where
 * a record is the subject's personal data versus Setnayan's own business record
 * (`platform_expenses`, `founder_time_log`, `vendor_client_notes` — notes a
 * supplier wrote ABOUT a client are both people's data at once). Those go to
 * him as questions, not as a fence.
 *
 * ⚠ THIS LIST IS THE MEASURED SET AS OF 2026-09-15, and the ratchet applies FROM
 * here — it is the baseline, not a parking space. It was taken from the guard's
 * own output rather than re-derived by hand, after a first attempt that read the
 * output through `head -40` and silently lost the alphabetically-last entry
 * (`vendor_member_token_wallets`) — and then a SECOND one (`vendor_team_members`),
 * because the guard reports every unaccounted table at once and the same `head`
 * hid two, not one. **A truncated capture of a correct measurement is a wrong
 * measurement, and it looks complete.** The list was finally settled by diffing
 * the registry against `information_schema` directly, with both sides printed.
 *
 * ✅ SORTED 2026-11-05 — 39 → 3. receipts, notifications, order_ledger and the
 * rest are now exported; the three left below each carry the owner question
 * that decides them.
 */
export const UNDECIDED_PERSON_KEYED_TABLES: ReadonlyArray<string> = [
  // ⚖ 39 → 3 on 2026-11-05. The other 36 are decided above (29 exported, 7
  // excluded with a reason). These three are left on purpose: each mixes the
  // subject's data with a fraud signal or another person's data, which is the
  // OWNER's call, not engineering's. Each line is the question put to him.
  //
  // Enforcement actions taken against a supplier's shop. The person key is the
  // ADMIN who acted; the shop owner is the one it is about. Question: should a
  // shop owner's file list the actions taken on their shop (what, when) — or is
  // it withheld as a fraud record, like fraud_signals?
  'fraud_enforcement_audit',
  // The fraud-prevention device hash (/privacy § Device identifier). It is the
  // person's own record AND a fraud signal kept after account deletion.
  // Question: include the last-seen dates (and the hash itself?) in the file,
  // or withhold it while the DPO review of how long it is kept is open?
  'user_devices',
  // A supplier's private notes ABOUT a client. Both people's data at once.
  // Question: give them to the supplier who wrote them, the client they are
  // about, both, or neither?
  'vendor_client_notes',
];
