require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  // Fix the typo in the email
  const fix = await pool.query(`UPDATE "users" SET "email" = 'lori04@gmail.com' WHERE "email" = 'lori04@gmai.com'`);
  console.log('Email typo fixed, rows:', fix.rowCount);

  // Set master admin flag
  const flag = await pool.query(`UPDATE "users" SET "is_master_admin" = true WHERE "email" = 'lori04@gmail.com'`);
  console.log('Master admin set, rows:', flag.rowCount);

  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
