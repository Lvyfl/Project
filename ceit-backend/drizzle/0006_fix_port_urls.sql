-- Fix hardcoded localhost:3001 URLs in posts.image_url
-- Replace all occurrences of localhost:3001 with localhost:3000
UPDATE posts
SET image_url = REPLACE(image_url, 'http://localhost:3001/', 'http://localhost:3000/')
WHERE image_url LIKE '%localhost:3001%';
