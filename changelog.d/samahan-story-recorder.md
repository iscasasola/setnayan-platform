## 2026-08-24 · change(samahan): the story composer records your 3 seconds — camera, not upload

Owner: *"this should be upload a video. it should be record your 3 seconds.
then compress it."* The stories button now opens a live in-app camera: it
records exactly three seconds, stops by itself, transcodes the take to
web720 on the phone (compressVideoForWeb), grabs the poster frame from the
last live frame, and posts. Flip camera supported; closing mid-record
abandons the take. The file picker survives only as the fallback for
devices where the camera is unavailable or refused — same duration gate and
compression either way.

4 source-shape pins (comments stripped), each mutation-tested with printed
occurrence counts: picker-first regression · the 3-second constant wired to
the auto-stop · abandon-on-close · compressed-copy-posts.

SPEC IMPACT: DECISION_LOG.md 2026-08-24 samahan-stories row amended (composer
is a recorder).
