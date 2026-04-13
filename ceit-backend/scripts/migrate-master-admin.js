require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_master_admin" boolean NOT NULL DEFAULT false`);
  console.log('Column added (or already existed).');
  const result = await pool.query(`UPDATE "users" SET "is_master_admin" = true WHERE "email" = 'lori04@gmail.com'`);
  console.log('Rows updated for lori04@gmail.com:', result.rowCount);
  await pool.end();
}

run().catch(e => { console.error('Error:', e.message); pool.end(); });
