ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_announcement boolean DEFAULT false NOT NULL;
