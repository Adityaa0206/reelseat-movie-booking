const mysql = require('mysql2/promise');
const config = require('./config');
const pool = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 10, timezone: 'Z' });

// Frees seats of pending bookings whose payment window passed. Safe to call repeatedly.
async function expirePendingBookings(conn = pool) {
  await conn.query(
    `UPDATE rs_booking_seats bs JOIN rs_bookings b ON b.id = bs.booking_id
        SET bs.active_key = NULL
      WHERE b.status = 'PENDING_PAYMENT' AND b.expires_at < UTC_TIMESTAMP()`);
  await conn.query(
    `UPDATE rs_bookings SET status = 'EXPIRED'
      WHERE status = 'PENDING_PAYMENT' AND expires_at < UTC_TIMESTAMP()`);
}
module.exports = { pool, expirePendingBookings };
