-- Migration: music tracks for kiosk background music
CREATE TABLE IF NOT EXISTS music (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    VARCHAR(255) NOT NULL,
  file_url    TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  volume      DECIMAL(3,2) NOT NULL DEFAULT 0.35,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);