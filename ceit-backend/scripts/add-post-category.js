require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS category varchar(100)')
  .then(() => { console.log('Migration OK: category column added'); pool.end(); })
  .catch(e => { console.error('Migration error:', e.message); pool.end(); process.exit(1); });
