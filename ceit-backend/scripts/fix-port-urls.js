const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://019c4557-da47-767b-97cd-b774998a6987:ef043b68-a1d1-4b43-81b3-781c3b21c87a@us-west-2.db.thenile.dev:5432/ceit_portal'
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
