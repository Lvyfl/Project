require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query('SELECT id, name, email, is_master_admin FROM "users"')
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
