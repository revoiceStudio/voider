var mysql = require('mysql');
var pool = mysql.createPool(
  JSON.parse(process.env.db_config)
);
module.exports = pool;