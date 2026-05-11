-- Re-point post.image_url values saved during local dev (http://localhost:3000/...) to production.
--
-- Before running on Nile:
--   1) Replace every occurrence of __PRODUCTION_API_ORIGIN__ below with your real API origin,
--      with NO trailing slash (example: https://ceit-backend.onrender.com).
--   2) This only changes text in the database. Images/PDFs must actually be available at that host
--      under /uploads/... and /documents/... (e.g. copy your local ceit-backend/uploads folder into
--      the Render image, or re-upload posts so they use Vercel Blob URLs).
--
UPDATE posts
SET image_url = REPLACE(image_url, 'http://localhost:3000', '__PRODUCTION_API_ORIGIN__')
WHERE image_url IS NOT NULL AND image_url LIKE '%http://localhost:3000%';

UPDATE posts
SET image_url = REPLACE(image_url, 'http://127.0.0.1:3000', '__PRODUCTION_API_ORIGIN__')
WHERE image_url IS NOT NULL AND image_url LIKE '%http://127.0.0.1:3000%';

UPDATE posts
SET image_url = REPLACE(image_url, 'https://localhost:3000', '__PRODUCTION_API_ORIGIN__')
WHERE image_url IS NOT NULL AND image_url LIKE '%https://localhost:3000%';

UPDATE posts
SET image_url = REPLACE(image_url, 'http://localhost:3001', '__PRODUCTION_API_ORIGIN__')
WHERE image_url IS NOT NULL AND image_url LIKE '%http://localhost:3001%';
