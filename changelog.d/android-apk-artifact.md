## 2026-09-08 · feat(build-android): also produce a directly installable APK

`build-android.yml` now runs `:app:assembleRelease` alongside `:app:bundleRelease` and uploads a
`setnayan-release-apk` artifact.

**Why:** an `.aab` is an upload format — Google Play splits it into per-device APKs at install
time, and it **cannot be sideloaded**. So with the Play organisation account blocked (the D-U-N-S
requested 2026-06-25 has not arrived; see
`build-sessions/STORE-SHELL-CLOSEOUT-2026-09-07.md` § 5), the bundle this workflow produced was
unreachable by any human: no store to publish it, and no way to put it on a phone.

The APK is signed with the **same upload keystore** as the bundle, so it installs directly on an
Android 10+ device.

🔑 **This is also how the app finally runs on real hardware.** Nobody has ever launched it on a
physical Android device — CI has only ever compiled it (DECISION_LOG 2026-06-07: *"NOT
runtime-tested (no AVD) — compile-verified only"*; the 2026-06-25 row still lists an on-device
smoke test as an open gate). An app about to be submitted to a store that no human has opened is
worth more attention than a build number.

The signature check finds `apksigner` by searching `$ANDROID_HOME/build-tools` rather than pinning
a version directory, which would rot on the next SDK bump; if it is genuinely absent the step
warns rather than failing, so a missing SDK tool cannot block a build that otherwise succeeded.

⚠ **Not a substitute for the Play upload.** A sideloaded APK gets no Play updates and no Play
integrity checks, and Play Console still requires the `.aab`. This is for testing and
hand-distribution.

SPEC IMPACT: None — additive CI output; no app code, no schema, no behaviour change.
