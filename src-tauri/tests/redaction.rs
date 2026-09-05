//! THE STREAM KEY MUST NOT BE IN ANYTHING THIS PROGRAM CAN EMIT.
//!
//! On the default tier the key is not even ours — the couple streams on their own
//! YouTube channel and hands us the key for their own broadcast
//! (`apps/web/lib/live-studio-manual-air.ts`). A key in a log file is somebody else's
//! channel, publishable by anyone who reads that file, for as long as they do not
//! rotate it. It is also the single most likely thing to leak, because it appears in
//! the connection URL, in the publish command, and — this one is not obvious — in the
//! *ingest's own refusal message*, which quotes the key back at us.
//!
//! Two guards, deliberately different in kind: one behavioural, over strings shaped
//! like the errors this program actually produces; one structural, counting how many
//! times the key is even *read* in the file that owns the socket. The behavioural test
//! catches a leak; the structural one catches the next author adding a path where one
//! could happen.

use setnayan_desktop_lib::encoder::rtmp::{Redactor, RtmpEndpoint, REDACTION};

const KEY: &str = "abcd-efgh-ijkl-mnop-qrst";

fn endpoint() -> RtmpEndpoint {
    RtmpEndpoint::parse("rtmps://a.rtmps.youtube.com/live2", Some(KEY)).unwrap()
}

#[test]
fn nothing_shaped_like_an_error_this_program_emits_survives_with_the_key_in_it() {
    let redactor = endpoint().redactor();

    // Every one of these is a real shape: an OS error quoting the address, a TLS
    // error, an RTMP protocol dump, an ingest's rejection text, a panic payload.
    let leaky = [
        format!("connection refused (rtmps://a.rtmps.youtube.com/live2/{KEY})"),
        format!("invalid peer certificate for host with key {KEY}"),
        format!("ClientSessionError(SessionInInvalidState {{ stream_key: \"{KEY}\" }})"),
        format!("stream key {KEY} is not authorised"),
        format!("{KEY}"),
        format!("{KEY}{KEY}"),
        format!("prefix {KEY} middle {KEY} suffix"),
    ];

    for text in &leaky {
        let scrubbed = redactor.scrub(text);
        assert!(
            !scrubbed.contains(KEY),
            "the key survived redaction:\n  in:  {text}\n  out: {scrubbed}"
        );
        assert!(
            scrubbed.contains(REDACTION),
            "something should have been redacted here: {text}"
        );
    }

    // And the only printable form of the destination.
    let endpoint = endpoint();
    assert_eq!(endpoint.redacted_url(), "rtmps://a.rtmps.youtube.com/live2/****");
    assert!(!format!("{endpoint:?}").contains(KEY), "Debug leaked it");
    assert!(!format!("{:?}", endpoint.redactor()).contains(KEY), "the Redactor leaked it");
}

#[test]
fn a_key_with_regex_or_url_punctuation_in_it_is_still_scrubbed_literally() {
    // Redaction is a literal replace, not a pattern match. A key containing `.` or `+`
    // must be removed as the exact string it is — and must not be treated as a
    // wildcard that eats the surrounding text either.
    for key in ["a.b+c*d", "key/with/slashes", "key?with=query&chars"] {
        let redactor = Redactor::new(key);
        let text = format!("publishing to rtmps://host/live2/{key} now");
        let scrubbed = redactor.scrub(&text);
        assert_eq!(scrubbed, format!("publishing to rtmps://host/live2/{REDACTION} now"));
    }
}

#[test]
fn an_empty_key_does_not_turn_every_character_into_a_redaction() {
    // `"abc".replace("", "****")` is `"****a****b****c****"`. A stream configured with
    // no key at all would otherwise produce logs no one can read, at the exact moment
    // someone is trying to work out why it will not go live.
    assert_eq!(Redactor::new("").scrub("connect failed"), "connect failed");
}

#[test]
fn the_socket_file_reads_the_stream_key_exactly_once() {
    // STRUCTURAL GUARD. `sender.rs` is the only file that touches a socket, and the
    // key has exactly one legitimate use in it: handing it to `request_publishing`.
    // Every other read is a new chance to log it. If this count changes, the change is
    // either a leak or a deliberate second use that should be justified here — either
    // way it deserves the two minutes this assertion costs.
    let source = include_str!("../src/encoder/sender.rs");
    let reads = source.matches("endpoint.stream_key").count();
    assert_eq!(
        reads, 1,
        "sender.rs reads the stream key {reads} times; exactly one read — the \
         `request_publishing` call — is expected. A new read must be justified."
    );

    // And it is never formatted. `{stream_key}` / `{:?}` on the endpoint are the two
    // ways this has gone wrong in other codebases.
    assert!(
        !source.contains("{stream_key}"),
        "sender.rs interpolates the stream key into a string"
    );
    assert!(
        !source.contains("{endpoint:?}") && !source.contains("{:?}\", self.endpoint"),
        "sender.rs Debug-prints the endpoint"
    );
}
