const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "::1",
  port: 3306,
  user: "root",
  password: "root123",
  database: "ticket_booking",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log("MySQL Pool Created");

module.exports = pool.promise();