require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const production = process.env.NODE_ENV === 'production';
const database = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'controle_pedidos'
};
if (production && (!(process.env.DB_HOST || process.env.MYSQLHOST) || !(process.env.DB_NAME || process.env.MYSQLDATABASE))) {
  throw new Error('Configure DB_HOST/DB_NAME ou MYSQLHOST/MYSQLDATABASE para o banco hospedado.');
}
const pool = mysql.createPool({
  ...database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: true,
  decimalNumbers: false,
  multipleStatements: false
});
module.exports = pool;
