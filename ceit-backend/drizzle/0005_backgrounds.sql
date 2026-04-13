-- Migration: viewer page backgrounds
CREATE TABLE IF NOT EXISTS backgrounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    VARCHAR(255) NOT NULL,
  image_url   TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
