-- If pdf_documents was created only with a legacy `data` bytea column (see postRoutes),
-- add `url` so blob-based rows and documentRoutes match migration 0001.
ALTER TABLE pdf_documents ADD COLUMN IF NOT EXISTS url text;
