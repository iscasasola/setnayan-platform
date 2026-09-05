//! WHERE TO PUBLISH, WHEN EACH FRAME HAPPENED, AND WHAT MAY NEVER BE LOGGED.
//!
//! Three small things the socket code should not be deciding for itself: the
//! destination it parses out of what YouTube (or the couple) gave us, the clock that
//! turns the wire's microseconds into RTMP's milliseconds, and the redactor that
//! stands between a stream key and every string this program can emit.
//!
//! ⚠ THE KEY IS NOT ALWAYS OURS. On the default tier the couple streams on their
//! OWN channel and the key is theirs — `apps/web/lib/live-studio-manual-air.ts` is
//! that route, and it is the DEFAULT, not the exception. Setnayan pool channels
//! exist only for the hosted-channel add-on. So "the key" here is a value of unknown
//! provenance that we hold on someone else's behalf, and it must be equally
//! unloggable in both cases. That is why redaction is a type you construct with the
//! key rather than a formatting convention people are asked to remember.

use std::fmt;

/// RTMP's chunk timestamp field is 24 bits. Past this many milliseconds every chunk
/// header must carry an extended 32-bit timestamp instead — and this many
/// milliseconds is **4 h 39 m 37 s**, which lands inside a wedding reception, not
/// after it. The vendored chunk serializer implements the encoding; the marathon
/// fixture in `tests/` is what proves it, because a boundary nobody crosses in a test
/// is a boundary nobody has tested.
pub const MAX_INITIAL_TIMESTAMP_MS: u32 = 16_777_215;

/// The default RTMP port, and the port RTMPS uses instead.
///
/// YouTube's RTMPS ingest is on **443** on purpose: it is the port that survives the
/// venue Wi-Fi, the hotel captive portal and the corporate firewall that block 1935.
pub const DEFAULT_RTMP_PORT: u16 = 1935;
pub const DEFAULT_RTMPS_PORT: u16 = 443;

/// A parsed publish destination.
#[derive(Clone, PartialEq, Eq)]
pub struct RtmpEndpoint {
    /// `rtmps://` — wrap the socket in TLS. `rtmp://` — do not.
    pub tls: bool,
    pub host: String,
    pub port: u16,
    /// The RTMP "application" — `live2` for YouTube.
    pub app: String,
    /// The stream key. **Never** put this in a log line, an error, or a panic message;
    /// construct a [`Redactor`] from it and pass strings through that instead.
    pub stream_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EndpointError {
    /// Neither `rtmp://` nor `rtmps://`.
    UnsupportedScheme,
    MissingHost,
    /// No application path — `rtmps://host` with nothing after it.
    MissingApp,
    /// No stream key, in the address or as its own argument. Refused rather than
    /// defaulted: publishing to an empty key is a connection that fails minutes later
    /// with a message from YouTube, instead of here with a message from us.
    MissingStreamKey,
    BadPort,
}

impl fmt::Display for EndpointError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            EndpointError::UnsupportedScheme => "ingest address must start with rtmp:// or rtmps://",
            EndpointError::MissingHost => "ingest address has no host",
            EndpointError::MissingApp => "ingest address has no application path (expected .../live2)",
            EndpointError::MissingStreamKey => "no stream key was given",
            EndpointError::BadPort => "ingest address has an unreadable port",
        };
        f.write_str(text)
    }
}

impl std::error::Error for EndpointError {}

impl RtmpEndpoint {
    /// Parse an ingest address plus an optional separately-held key.
    ///
    /// Both shapes are real and both arrive:
    ///   · `("rtmps://a.rtmps.youtube.com/live2", Some(key))` — what the YouTube Data
    ///     API returns, address and key as separate fields.
    ///   · `("rtmps://a.rtmps.youtube.com/live2/xxxx-xxxx", None)` — what a person
    ///     pastes, because that is how every OBS tutorial writes it.
    /// A key given as its own argument wins over one found in the path, so a stale
    /// address cannot quietly outrank the key the caller just fetched.
    pub fn parse(address: &str, stream_key: Option<&str>) -> Result<RtmpEndpoint, EndpointError> {
        let address = address.trim();
        let (tls, rest) = if let Some(rest) = address.strip_prefix("rtmps://") {
            (true, rest)
        } else if let Some(rest) = address.strip_prefix("rtmp://") {
            (false, rest)
        } else {
            return Err(EndpointError::UnsupportedScheme);
        };

        let mut parts = rest.splitn(2, '/');
        let authority = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("").trim_matches('/');

        if authority.is_empty() {
            return Err(EndpointError::MissingHost);
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port_text)) => {
                let port = port_text.parse::<u16>().map_err(|_| EndpointError::BadPort)?;
                if port == 0 {
                    return Err(EndpointError::BadPort);
                }
                (host, port)
            }
            None => (
                authority,
                if tls { DEFAULT_RTMPS_PORT } else { DEFAULT_RTMP_PORT },
            ),
        };
        if host.is_empty() {
            return Err(EndpointError::MissingHost);
        }

        // Everything before the last path segment is the application; the last segment
        // is the key when the caller did not hand us one. YouTube's app is a single
        // segment (`live2`), but MediaMTX and friends nest (`live/sub/key`), so this
        // splits at the LAST separator rather than assuming a depth.
        let (app, key_in_path) = match path.rsplit_once('/') {
            Some((app, key)) => (app.to_string(), Some(key.to_string())),
            None => (path.to_string(), None),
        };
        if app.is_empty() {
            return Err(EndpointError::MissingApp);
        }

        let stream_key = match stream_key.map(str::trim) {
            Some(key) if !key.is_empty() => key.to_string(),
            _ => match key_in_path {
                Some(key) if !key.is_empty() => key,
                _ => return Err(EndpointError::MissingStreamKey),
            },
        };

        Ok(RtmpEndpoint { tls, host: host.to_string(), port, app, stream_key })
    }

    /// `host:port`, for the socket.
    pub fn socket_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    /// The `tcUrl` the RTMP `connect` command carries. Some ingests — YouTube's
    /// included — reject a connect without it.
    pub fn tc_url(&self) -> String {
        let scheme = if self.tls { "rtmps" } else { "rtmp" };
        let default_port = if self.tls { DEFAULT_RTMPS_PORT } else { DEFAULT_RTMP_PORT };
        if self.port == default_port {
            format!("{}://{}/{}", scheme, self.host, self.app)
        } else {
            format!("{}://{}:{}/{}", scheme, self.host, self.port, self.app)
        }
    }

    /// The full URL **with the key replaced by asterisks** — the only form of this
    /// destination that may be shown to anyone.
    pub fn redacted_url(&self) -> String {
        let scheme = if self.tls { "rtmps" } else { "rtmp" };
        format!("{}://{}/{}/{}", scheme, self.host, self.app, REDACTION)
    }

    /// A redactor bound to this endpoint's key.
    pub fn redactor(&self) -> Redactor {
        Redactor::new(&self.stream_key)
    }
}

/// `Debug` is written by hand, and prints the redacted URL.
///
/// A derived `Debug` would print `stream_key: "abcd-efgh-…"`, and the string that
/// eventually leaks a key is never the one someone wrote on purpose — it is a
/// `{:?}` in a log line, a `.expect()` message, or a panic payload written by
/// somebody who did not know this struct held a secret. Deriving it here would be
/// leaving that loaded.
impl fmt::Debug for RtmpEndpoint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RtmpEndpoint")
            .field("url", &self.redacted_url())
            .field("tls", &self.tls)
            .field("port", &self.port)
            .finish()
    }
}

/// What a key is replaced by.
pub const REDACTION: &str = "****";

/// Scrubs a stream key out of anything on its way to a log, an error, an event or a
/// panic message.
///
/// Deliberately a VALUE, not a function: `redact_url(url)` would only cover strings
/// someone remembered were URLs, and the string that leaks a key is never the one you
/// remembered. Anything the sender emits goes through `scrub`, and the test in
/// `tests/redaction.rs` asserts that over the sender's whole output rather than over a
/// list of formats someone kept up to date.
#[derive(Clone)]
pub struct Redactor {
    key: String,
}

impl Redactor {
    pub fn new(stream_key: &str) -> Redactor {
        Redactor { key: stream_key.to_string() }
    }

    /// Replace every occurrence of the key. An empty key scrubs nothing — replacing
    /// the empty string would otherwise insert `****` between every character.
    pub fn scrub(&self, text: &str) -> String {
        if self.key.is_empty() {
            return text.to_string();
        }
        text.replace(&self.key, REDACTION)
    }
}

/// A `Redactor` never shows its key, including when something formats it by accident.
impl fmt::Debug for Redactor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Redactor({REDACTION})")
    }
}

/// Microseconds on the wire → milliseconds on the RTMP timeline.
///
/// Two jobs, both of which have a wrong-looking easy version:
///
/// 1. **Rebase to the first chunk.** `ts_us` is the S3 master clock, which starts
///    whenever the AudioContext did, not when we connected. Sending its absolute value
///    would open the stream at some arbitrary timestamp; YouTube tolerates that far
///    less well than it tolerates a stream that starts at 0. The base is taken ONCE,
///    from whichever track speaks first, so video and audio stay on one timeline —
///    rebasing each track to its own first chunk would offset one against the other
///    by however long the second one took to arrive.
/// 2. **Never go backwards — PER TRACK.** Video and audio arrive interleaved from
///    separate encoders. RTMP computes chunk-header deltas by subtraction on an
///    unsigned type, so a backwards step does not produce a small negative: it
///    produces a delta near 2^32, which is a header the ingest cannot read. Clamping
///    is the defence — but it must be per track, because RTMP keeps video and audio on
///    **separate chunk streams** with separate deltas, and an audio frame at 90 ms
///    legitimately follows a video frame at 100 ms.
///
/// ⚠ A SHARED CLAMP IS AN A/V SYNC BUG, NOT A ROUNDING ONE. The first version of this
/// clock kept one `last_ms` for everything. Replaying a real 2-second fixture through
/// it (`examples/publish_probe.rs`) clamped **295 timestamps in ten minutes** of stream
/// — every one of them an audio frame dragged forward onto the last video frame's
/// timestamp. Ten minutes of that is audio walking steadily out of sync with picture
/// on a wedding recording that cannot be re-shot. The counter is what made it visible;
/// the fix is that `Track` parameter.
///
/// It does NOT wrap at 24 bits. The 24-bit ceiling belongs to the chunk *header*
/// encoding, and the vendored serializer emits an extended timestamp past it; a clock
/// that helpfully masked to 24 bits would make that unreachable and break the stream
/// at 4 h 39 m instead of fixing it.
#[derive(Debug, Clone)]
pub struct RtmpClock {
    base_us: Option<u64>,
    last_video_ms: u32,
    last_audio_ms: u32,
    clamped: u64,
}

/// The two RTMP chunk streams a publish uses. Separate timelines, separate deltas.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Track {
    Video,
    Audio,
}

impl RtmpClock {
    pub fn new() -> RtmpClock {
        RtmpClock { base_us: None, last_video_ms: 0, last_audio_ms: 0, clamped: 0 }
    }

    /// Stamp a chunk on one track. The first chunk on either track defines zero.
    pub fn stamp(&mut self, track: Track, ts_us: u64) -> u32 {
        let base = *self.base_us.get_or_insert(ts_us);
        let elapsed_us = ts_us.saturating_sub(base);
        let ms = (elapsed_us / 1_000).min(u32::MAX as u64) as u32;
        let last = match track {
            Track::Video => &mut self.last_video_ms,
            Track::Audio => &mut self.last_audio_ms,
        };
        if ms < *last {
            self.clamped += 1;
            return *last;
        }
        *last = ms;
        ms
    }

    /// How many chunks arrived out of order **on their own track** and were clamped.
    /// S9's health surface reports it; a rising count is a producer problem, not a
    /// network problem, and those two get confused every time nobody counts.
    pub fn clamped_count(&self) -> u64 {
        self.clamped
    }

    /// Whether this stream has run past RTMP's 24-bit chunk-timestamp ceiling —
    /// i.e. whether extended timestamps are now in play for real, in production,
    /// rather than only in the marathon fixture.
    pub fn past_24_bit_ceiling(&self) -> bool {
        self.last_ms() >= MAX_INITIAL_TIMESTAMP_MS
    }

    /// The furthest either track has reached.
    pub fn last_ms(&self) -> u32 {
        self.last_video_ms.max(self.last_audio_ms)
    }
}

impl Default for RtmpClock {
    fn default() -> Self {
        RtmpClock::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_shapes_parse_the_same_whether_the_key_is_split_out_or_pasted_in() {
        let split = RtmpEndpoint::parse(
            "rtmps://a.rtmps.youtube.com/live2",
            Some("abcd-efgh-ijkl-mnop-qrst"),
        )
        .unwrap();
        let pasted = RtmpEndpoint::parse(
            "rtmps://a.rtmps.youtube.com/live2/abcd-efgh-ijkl-mnop-qrst",
            None,
        )
        .unwrap();
        assert_eq!(split, pasted);
        assert!(split.tls);
        assert_eq!(split.port, 443, "RTMPS defaults to the port that gets through venue Wi-Fi");
        assert_eq!(split.app, "live2");
        assert_eq!(split.socket_address(), "a.rtmps.youtube.com:443");
        assert_eq!(split.tc_url(), "rtmps://a.rtmps.youtube.com/live2");
    }

    #[test]
    fn an_explicit_key_outranks_one_left_in_the_address() {
        let endpoint =
            RtmpEndpoint::parse("rtmps://a.rtmps.youtube.com/live2/stale", Some("fresh")).unwrap();
        assert_eq!(endpoint.stream_key, "fresh");
    }

    #[test]
    fn plain_rtmp_and_explicit_ports_are_both_understood() {
        let local = RtmpEndpoint::parse("rtmp://127.0.0.1/live/test", None).unwrap();
        assert!(!local.tls);
        assert_eq!(local.port, 1935);
        assert_eq!(local.tc_url(), "rtmp://127.0.0.1/live");

        let odd = RtmpEndpoint::parse("rtmp://127.0.0.1:19350/live", Some("k")).unwrap();
        assert_eq!(odd.port, 19350);
        assert_eq!(odd.tc_url(), "rtmp://127.0.0.1:19350/live");
    }

    #[test]
    fn a_nested_application_path_keeps_its_depth() {
        let endpoint = RtmpEndpoint::parse("rtmp://host/live/sub/key", None).unwrap();
        assert_eq!(endpoint.app, "live/sub");
        assert_eq!(endpoint.stream_key, "key");
    }

    #[test]
    fn every_way_the_destination_can_be_unusable_is_named() {
        assert_eq!(
            RtmpEndpoint::parse("https://a.rtmps.youtube.com/live2", Some("k")).unwrap_err(),
            EndpointError::UnsupportedScheme
        );
        assert_eq!(
            RtmpEndpoint::parse("rtmps:///live2", Some("k")).unwrap_err(),
            EndpointError::MissingHost
        );
        assert_eq!(
            RtmpEndpoint::parse("rtmps://host", Some("k")).unwrap_err(),
            EndpointError::MissingApp
        );
        assert_eq!(
            RtmpEndpoint::parse("rtmps://host/live2", None).unwrap_err(),
            EndpointError::MissingStreamKey
        );
        assert_eq!(
            RtmpEndpoint::parse("rtmps://host:0/live2", Some("k")).unwrap_err(),
            EndpointError::BadPort
        );
        assert_eq!(
            RtmpEndpoint::parse("rtmps://host:https/live2", Some("k")).unwrap_err(),
            EndpointError::BadPort
        );
        // A key of nothing but whitespace is no key.
        assert_eq!(
            RtmpEndpoint::parse("rtmps://host/live2", Some("   ")).unwrap_err(),
            EndpointError::MissingStreamKey
        );
    }

    #[test]
    fn the_only_printable_form_of_a_destination_has_no_key_in_it() {
        let endpoint = RtmpEndpoint::parse(
            "rtmps://a.rtmps.youtube.com/live2",
            Some("abcd-efgh-ijkl-mnop-qrst"),
        )
        .unwrap();
        let printed = endpoint.redacted_url();
        assert_eq!(printed, "rtmps://a.rtmps.youtube.com/live2/****");
        assert!(!printed.contains("abcd-efgh"));
        assert!(!format!("{:?}", endpoint.redactor()).contains("abcd-efgh"));
        // The `{:?}` nobody meant to write is the one that leaks.
        assert!(
            !format!("{endpoint:?}").contains("abcd-efgh"),
            "Debug leaked the key: {endpoint:?}"
        );
    }

    #[test]
    fn the_redactor_scrubs_a_key_wherever_it_appears_and_not_when_it_is_empty() {
        let redactor = Redactor::new("secret-key");
        assert_eq!(
            redactor.scrub("connect to rtmps://h/live2/secret-key failed (secret-key)"),
            "connect to rtmps://h/live2/**** failed (****)"
        );
        assert_eq!(Redactor::new("").scrub("nothing to hide"), "nothing to hide");
    }

    #[test]
    fn the_clock_starts_at_the_first_chunk_and_counts_milliseconds() {
        let mut clock = RtmpClock::new();
        assert_eq!(clock.stamp(Track::Video, 9_000_000_000), 0, "the first chunk defines zero");
        assert_eq!(clock.stamp(Track::Video, 9_000_033_366), 33);
        assert_eq!(clock.stamp(Track::Video, 9_001_000_000), 1_000);
    }

    #[test]
    fn both_tracks_share_one_zero_but_not_one_monotonic_guard() {
        // The base is shared: audio arriving 40 ms after the first video frame is 40 ms
        // into the stream, not 0. The guard is not: an audio frame behind the last
        // VIDEO frame is normal interleaving, and clamping it would walk the sound out
        // of sync with the picture for the length of the wedding.
        let mut clock = RtmpClock::new();
        assert_eq!(clock.stamp(Track::Video, 1_000_000), 0);
        assert_eq!(clock.stamp(Track::Video, 1_100_000), 100);
        assert_eq!(clock.stamp(Track::Audio, 1_040_000), 40, "audio keeps its own timeline");
        assert_eq!(clock.stamp(Track::Audio, 1_060_000), 60);
        assert_eq!(clock.clamped_count(), 0, "interleaving is not disorder");
    }

    #[test]
    fn a_chunk_that_arrives_behind_is_clamped_not_sent_backwards() {
        // Unclamped this is a chunk delta of ~2^32, which is a header the ingest
        // cannot read — the failure looks like corruption, not like a late frame.
        let mut clock = RtmpClock::new();
        clock.stamp(Track::Video, 0);
        assert_eq!(clock.stamp(Track::Video, 2_000_000), 2_000);
        assert_eq!(clock.stamp(Track::Video, 1_000_000), 2_000, "clamped to the last stamp");
        assert_eq!(clock.clamped_count(), 1);
        assert_eq!(clock.stamp(Track::Video, 3_000_000), 3_000, "and the clock carries on");
    }

    #[test]
    fn the_clock_walks_past_the_24_bit_ceiling_without_wrapping() {
        let mut clock = RtmpClock::new();
        clock.stamp(Track::Video, 0);
        assert!(!clock.past_24_bit_ceiling());
        // 4 h 39 m 37 s, and then one millisecond more.
        assert_eq!(clock.stamp(Track::Video, 16_777_215_000), MAX_INITIAL_TIMESTAMP_MS);
        assert!(clock.past_24_bit_ceiling());
        assert_eq!(clock.stamp(Track::Video, 16_777_216_000), 16_777_216, "no 24-bit mask anywhere");
        // A five-hour reception.
        assert_eq!(clock.stamp(Track::Video, 18_000_000_000), 18_000_000);
    }
}
