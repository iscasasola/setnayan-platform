## 2026-11-22 · chore(ship): batch U — one registered business · Drive copy per event · supplier free files private · guests polish

Not Apple-gating. Four handed-over PRs, one CI run.

- **#8167** @ 7172b70524: one verified shop per DTI/SEC registration number, and every branch carries its shop's number. Migration `20271359913146` → 570cabcbc3 (controller GO). An admin verifying a second shop under a number another real shop holds now gets a 23514 refusal, as the owner's rule intends. This is #8167's first real CI run: its earlier runs were cancelled or draft-skipped.
- **#8170** @ 6f0f41ffb5: a shop copies an event to its own Google Drive. Migration `20271359577754` → b1ac9431dc (controller GO). Every rewritten CHECK is a superset of the live one.
- **#8168** @ e66efedd0a: supplier free files private. Follow-up routed to the controller: the files still sit in the public `setnayan-media` bucket, so the signed link is not a real privacy boundary.
- **#8179** @ 89af442868: guests drawing v4 polish (stacked on the merged #8152).

Root map: three findings were added to the baseline, each with its reason. Two are false "broken doors": the shop-Drive back-cookie's `path: '/api/oauth/drive'` scope is not a link. The third is `/dev/drive-copy-lab`, a dev lab that returns 404 in production. `root-map --baseline` was not used wholesale, because it would have overwritten three existing reasons and silenced five unrelated wrong-words warnings.

Exposure +3: `vendor_profile_id` on `drive_copy_artifacts`, `drive_copy_folders` and `oauth_state`, with the same grants as every other column on those tables. RLS is unchanged.

SPEC IMPACT: None beyond what each PR's own fragment records.
