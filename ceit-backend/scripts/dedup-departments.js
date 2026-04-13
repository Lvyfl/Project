require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  // For each department name, keep the first id, delete the second
  const { rows } = await pool.query(`SELECT id, name FROM departments ORDER BY name, id`);

  const seen = new Map(); // name -> id to keep

  for (const row of rows) {
    if (!seen.has(row.name)) {
      seen.set(row.name, row.id);
    } else {
      const keepId = seen.get(row.name);
      const removeId = row.id;

      // Reassign users pointing to the duplicate
      const u = await pool.query(
        `UPDATE users SET department_id = $1 WHERE department_id = $2`,
        [keepId, removeId]
      );
      console.log(`Reassigned ${u.rowCount} user(s) from dept ${removeId} → ${keepId} (${row.name})`);

      // Reassign posts if they reference department_id
      try {
        const p = await pool.query(
          `UPDATE posts SET department_id = $1 WHERE department_id = $2`,
          [keepId, removeId]
        );
        console.log(`Reassigned ${p.rowCount} post(s) for ${row.name}`);
      } catch { /* posts table may not have department_id */ }

      // Reassign events
      try {
        const ev = await pool.query(
          `UPDATE events SET department_id = $1 WHERE department_id = $2`,
          [keepId, removeId]
        );
        console.log(`Reassigned ${ev.rowCount} event(s) for ${row.name}`);
      } catch { /* ignore */ }

      // Delete the duplicate department
      await pool.query(`DELETE FROM departments WHERE id = $1`, [removeId]);
      console.log(`Deleted duplicate department: ${row.name} (${removeId})`);
    }
  }

  console.log('\nDone. Remaining departments:');
  const final = await pool.query('SELECT id, name FROM departments ORDER BY name');
  console.table(final.rows);

  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
