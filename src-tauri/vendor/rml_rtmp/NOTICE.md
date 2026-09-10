# Vendored third-party source — `rml_rtmp` 0.8.0

**Upstream:** https://github.com/KallDrexx/rust-media-libs (`rtmp/`, git
`a25df6bc35cdc33f21f7a35efc97e700dcc8fa17`) · **License:** MIT, see `LICENSE-MIT`
(© 2017 Matthew Shapiro) · **Author:** Matthew Shapiro <me@mshapiro.net>

## What this is

The sans-IO RTMP protocol implementation Setnayan's desktop encoder speaks to YouTube with
(`ClientSession::request_publishing` / `publish_video_data` / `publish_audio_data`, plus the
chunk serializer that owns RTMP's extended-timestamp encoding). It handles the protocol; it
does no networking, so TLS (`tokio-rustls`, for RTMPS on :443) is ours to wrap around it.

## Why it is vendored rather than depended on from crates.io

`rml_rtmp` 0.8.0 was published in 2023 and the upstream repository has had no release since.
Setnayan streams a wedding for four to six hours in one unbroken publish, which walks straight
into the two places this crate is thinnest — the 24-bit chunk timestamp boundary at 16,777,215 ms
(4 h 39 m 37 s) and the `// TODO: Update to support rtmp time wrap-around` in
`src/chunk_io/serializer.rs` — and there is no upstream release to carry a fix in. Vendoring is
what makes a fix possible on our own schedule instead of nobody's.

## What was changed

**Nothing.** This is the crates.io `.crate` for 0.8.0 unpacked verbatim
(sha256 `a354e80eb7aa2a6fed09b3bd25c19bcfd32cf51f81f1219f4ec04f34519989da`), with three files
added by us — this NOTICE, `LICENSE-MIT` fetched from the upstream repository (the published
`.crate` ships no license file), and `Readme.md` renamed to `README.md` to match the name its own
manifest declares. The `.cargo_vcs_info.json` above is upstream's, and is what pins the git sha.

**If you patch this tree, say so here, in a list, with the reason and the test that covers it.**
A vendored dependency nobody records changes to is indistinguishable from an abandoned fork.

## How it is wired

`src-tauri/Cargo.toml` takes it as a path dependency and, so any transitive `rml_rtmp` resolves
to the same copy, redirects crates.io to it with `[patch.crates-io]`. Its own dependencies
(`rml_amf0`, `byteorder`, `bytes`, `rand`, `hmac`, `sha2`, `thiserror`) still come from crates.io
and are locked in `Cargo.lock`.
