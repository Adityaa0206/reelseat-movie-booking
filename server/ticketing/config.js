try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
module.exports = {
  holdSeconds: num(process.env.SEAT_HOLD_SECONDS, 300),               // 5 minutes
  checkoutPendingSeconds: num(process.env.CHECKOUT_PENDING_SECONDS, 600),
  maxSeatsPerHold: num(process.env.MAX_SEATS_PER_HOLD, 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:9000',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};
