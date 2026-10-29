const config = require('./config');
const { pool, expirePendingBookings } = require('./db');
const { redis, extendKeys, releaseKeys } = require('./redis');
const { HttpError } = require('./errors');
const { requireActiveHold, loadShowtime, loadSeats, seatKey, groupKey } = require('./holdService');
const { seatPrice, totalPrice } = require('./pricing');

const bookingView = (b) => ({
  bookingId: b.id, showtimeId: b.showtime_id, status: b.status,
  totalPaise: b.total_paise, currency: b.currency, paymentWindowEndsAt: b.expires_at && new Date(b.expires_at).toISOString(),
});

// Creates (or returns the existing) PENDING_PAYMENT booking for a hold. Never marks anything paid.
async function createCheckout(userId, holdId) {
  const rec = await requireActiveHold(userId, holdId);
  const showtime = await loadShowtime(rec.showtimeId);
  const seats = await loadSeats(showtime.screen_id, rec.seatIds);
  const total = totalPrice(showtime, seats);                       // server-side price, ignores client totals

  // keep the hold alive for the whole payment window
  const keys = rec.seatIds.map((s) => seatKey(rec.showtimeId, s));
  const ttlMs = config.checkoutPendingSeconds * 1000;
  if (!(await extendKeys(keys, userId, rec.holdId, ttlMs)))
    throw new HttpError(410, 'HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
  await redis.pexpire(groupKey(rec.holdId), ttlMs);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await expirePendingBookings(conn);
    const [[existing]] = await conn.query(`SELECT * FROM rs_bookings WHERE hold_id = ? FOR UPDATE`, [rec.holdId]);
    if (existing) {
      await conn.commit();
      if (existing.user_id !== userId) throw new HttpError(404, 'HOLD_NOT_FOUND', 'Hold not found.');
      if (existing.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'BOOKING_NOT_PENDING', `Booking is ${existing.status}.`);
      return bookingView(existing);
    }
    const [r] = await conn.query(
      `INSERT INTO rs_bookings (user_id, showtime_id, hold_id, status, total_paise, currency, expires_at)
       VALUES (?, ?, ?, 'PENDING_PAYMENT', ?, 'INR', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
      [userId, rec.showtimeId, rec.holdId, total, config.checkoutPendingSeconds]);
    for (const s of seats) {
      await conn.query(
        `INSERT INTO rs_booking_seats (booking_id, showtime_id, seat_id, price_paise, active_key) VALUES (?, ?, ?, ?, 1)`,
        [r.insertId, rec.showtimeId, s.id, seatPrice(showtime, s)]);   // unique key blocks double-selling
    }
    await conn.commit();
    const [[b]] = await pool.query(`SELECT * FROM rs_bookings WHERE id = ?`, [r.insertId]);
    return bookingView(b);
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    if (e && e.code === 'ER_DUP_ENTRY')
      throw new HttpError(409, 'SEATS_UNAVAILABLE', 'Some seats were just booked by someone else.');
    throw e;
  } finally { conn.release(); }
}

async function freeRedisForBooking(conn, booking) {
  const [seatRows] = await conn.query(`SELECT seat_id FROM rs_booking_seats WHERE booking_id = ?`, [booking.id]);
  await releaseKeys(seatRows.map((r) => seatKey(booking.showtime_id, r.seat_id)), booking.user_id, booking.hold_id);
  await redis.del(groupKey(booking.hold_id));
}

// Shared by cancel and payment failure. Only the owner may cancel (enforced by caller via userId filter).
async function closePendingBooking(bookingId, userId, newStatus) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[b]] = await conn.query(
      `SELECT * FROM rs_bookings WHERE id = ? ${userId != null ? 'AND user_id = ?' : ''} FOR UPDATE`,
      userId != null ? [bookingId, userId] : [bookingId]);
    if (!b) { await conn.rollback(); throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.'); }
    if (b.status === 'CONFIRMED') { await conn.rollback(); throw new HttpError(409, 'REFUND_REQUIRED', 'Confirmed bookings need the refund flow, which is not implemented yet.'); }
    if (b.status === 'PENDING_PAYMENT') {
      await conn.query(`UPDATE rs_bookings SET status = ? WHERE id = ?`, [newStatus, b.id]);
      await conn.query(`UPDATE rs_booking_seats SET active_key = NULL WHERE booking_id = ?`, [b.id]);
    }
    await conn.commit();
    await freeRedisForBooking(pool, b);
    return { bookingId: b.id, status: b.status === 'PENDING_PAYMENT' ? newStatus : b.status };
  } catch (e) { try { await conn.rollback(); } catch (_) {} throw e; }
  finally { conn.release(); }
}
const cancelBooking = (userId, bookingId) => closePendingBooking(Number(bookingId), userId, 'CANCELLED');
const markPaymentFailed = (bookingId) => closePendingBooking(Number(bookingId), null, 'PAYMENT_FAILED'); // for future webhook

// NOT exposed by any route. A future payment webhook must call this ONLY after verifying the
// payment with the provider's API/signature. `verified` is that provider-verified result.
async function finalizePaidBooking(bookingId, verified) {
  if (!verified || verified.verified !== true || !verified.provider || !verified.providerPaymentId)
    throw new Error('Refusing to confirm: payment is not verified.');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[b]] = await conn.query(`SELECT * FROM rs_bookings WHERE id = ? FOR UPDATE`, [bookingId]);
    if (!b || b.status !== 'PENDING_PAYMENT' || new Date(b.expires_at) < new Date())
      throw new HttpError(409, 'BOOKING_NOT_PENDING', 'Booking is not awaiting payment.');
    if (Number(verified.amountPaise) !== b.total_paise)
      throw new HttpError(409, 'AMOUNT_MISMATCH', 'Verified amount does not match booking total.');
    await conn.query(
      `INSERT INTO rs_payments (booking_id, provider, provider_payment_id, amount_paise, status, verified_at)
       VALUES (?, ?, ?, ?, 'VERIFIED', UTC_TIMESTAMP())`,
      [b.id, verified.provider, verified.providerPaymentId, b.total_paise]);
    await conn.query(`UPDATE rs_bookings SET status = 'CONFIRMED' WHERE id = ?`, [b.id]);
    await conn.commit();
    await freeRedisForBooking(pool, b);   // seats are now owned by MySQL; drop temporary locks
    return { bookingId: b.id, status: 'CONFIRMED' };
  } catch (e) { try { await conn.rollback(); } catch (_) {} throw e; }
  finally { conn.release(); }
}

async function myBookings(userId) {
  const [rows] = await pool.query(`SELECT * FROM rs_bookings WHERE user_id = ? ORDER BY id DESC LIMIT 50`, [userId]);
  return rows.map(bookingView);
}
module.exports = { createCheckout, cancelBooking, markPaymentFailed, finalizePaidBooking, myBookings };
