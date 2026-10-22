-- Event consumers run inside tenant transactions (as app_user) and record idempotency there.
-- processed_events holds only (consumer, event_id), no tenant data.
GRANT SELECT, INSERT ON processed_events TO app_user;
