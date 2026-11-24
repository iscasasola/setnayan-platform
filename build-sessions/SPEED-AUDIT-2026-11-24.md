# Speed audit: every page, 24 Nov 2026

> Read-only audit. No app code changed. Status: **in progress**: the tables below fill in as each step lands.

Owner rule: every page loads in under 0.7 s at 390 px, with one batched read per screen.
The pattern to copy is PR #8278 ("perf(supplier): Shop and Toolkit reads in one round").
