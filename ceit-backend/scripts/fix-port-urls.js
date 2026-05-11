require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL (e.g. from .env) before running this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(
  "UPDATE posts SET image_url = REPLACE(image_url, 'http://localhost:3001/', 'http://localhost:3000/') WHERE image_url LIKE '%localhost:3001%'"
)
  .then(r => {
    console.log('Rows fixed:', r.rowCount);
    return pool.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    pool.end();
  });
