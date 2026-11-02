## 2026-06-22 · tweak(std): music entrance fade-in shortened 3s → 1s

Owner: make the Save-the-Date background-music entrance fade 1 second instead of 3. `FADE_MS` in the dedicated entrance fade-in effect (save-the-date-film.tsx) is now 1000ms; comments updated to match. Desktop/Android fade in over 1s; iOS still starts cleanly at the lift (volume read-only). No other behavior changes.

SPEC IMPACT: `0024_save_the_date/` — STD music entrance fade is 1s. (Reference/history only.)
