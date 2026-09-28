const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
(async()=>{try{await pool.query(fs.readFileSync('./schema.sql','utf8'));console.log('ROK database ready');}finally{await pool.end();}})();
