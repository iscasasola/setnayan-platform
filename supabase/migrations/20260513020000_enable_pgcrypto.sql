-- Enable pgcrypto for gen_random_bytes() used by event_join_tokens.token
-- and guests.qr_token defaults.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
