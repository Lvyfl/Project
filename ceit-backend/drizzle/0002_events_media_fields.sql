ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_image_url text,
  ADD COLUMN IF NOT EXISTS event_link text;
