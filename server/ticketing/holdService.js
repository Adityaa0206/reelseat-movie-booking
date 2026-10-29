const { randomUUID } = require('crypto');
const config = require('./config');
const { pool, expirePendingBookings } = require('./db');
const { redis, holdKeys, releaseKeys } = require('./redis');
const { HttpError } = require('./errors');
const { totalPrice } = require('./pricing');

const seatKey = (showtimeId, seatId) => `rs:hold:${showtimeId}:${seatId}`;
const groupKey = (holdId) => `rs:holdgroup:${holdId}`;

const toId = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'VALIDATION', `${name} must be a positive integer.`);
  return n;
};
const uniqueIds = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) throw new HttpError(400, 'VALIDATION', 'seatIds must be a non-empty array.');
  if (arr.length > config.maxSeatsPerHold) throw new HttpError(400, 'TOO_MANY_SEATS', `You can hold at most ${config.maxSeatsPerHold} seats.`);
  return [...new Set(arr.map((x) => toId(x, 'seatIds[]')))];
};

async function loadShowtime(showtimeId, db = pool) {
  const [[st]] = await db.query(
    `SELECT id, screen_id, base_price_paise, starts_at, status FROM rs_showtimes WHERE id = ?`, [showtimeId]);
  if (!st) throw new HttpError(404, 'SHOWTIME_NOT_FOUND', 'Showtime not found.');
  if (st.status !== 'ACTIVE' || new Date(st.starts_at) <= new Date())
    throw new HttpError(409, 'SHOWTIME_CLOSED', 'This showtime is no longer bookable.');
  return st;
}
async function loadSeats(screenId, seatIds, db = pool) {
  const [rows] = await db.query(
    `SELECT id, row_label, seat_number, category, price_multiplier
       FROM rs_screen_seats WHERE screen_id = ? AND id IN (?)`, [screenId, seatIds]);
  if (rows.length !== seatIds.length)
    throw new HttpError(400, 'INVALID_SEATS', 'One or more seats do not belong to this showtime\'s screen.');
  return rows;
}

async function readRecord(holdId) {
  const raw = await redis.get(groupKey(holdId));
  return raw ? JSON.parse(raw) : null;
}

async function createHold(userId, body) {
  const showtimeId = toId(body.showtimeId, 'showtimeId');
  const seatIds = uniqueIds(body.seatIds);
  const showtime = await loadShowtime(showtimeId);
  const seats = await loadSeats(showtime.screen_id, seatIds);

  await expirePendingBookings();
  const [booked] = await pool.query(
    `SELECT seat_id FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1 AND seat_id IN (?)`,
    [showtimeId, seatIds]);
  if (booked.length)
    throw new HttpError(409, 'SEATS_UNAVAILABLE', 'Some seats are already booked.', { seatIds: booked.map((r) => r.seat_id) });

  // Optional: replace the selection of an existing hold you own (same showtime).
  let holdId = randomUUID(), previous = null;
  if (body.holdId) {
    previous = await readRecord(String(body.holdId));
    if (previous && (previous.userId !== userId || previous.showtimeId !== showtimeId))
      throw new HttpError(404, 'HOLD_NOT_FOUND', 'Hold not found.');
    if (previous) holdId = String(body.holdId);
  }

  const ttlMs = config.holdSeconds * 1000;
  const keys = seatIds.map((id) => seatKey(showtimeId, id));
  const conflictIdx = await holdKeys(keys, userId, holdId, ttlMs);
  if (conflictIdx) {
    throw new HttpError(409, 'SEATS_UNAVAILABLE', 'Some seats are being held by another user.', { seatIds: [seatIds[conflictIdx - 1]] });
  }
  const expiresAt = Date.now() + ttlMs;
  await redis.set(groupKey(holdId), JSON.stringify({ holdId, userId, showtimeId, seatIds, expiresAt }), 'PX', ttlMs);

  if (previous) {   // free seats dropped from the selection
    const dropped = previous.seatIds.filter((s) => !seatIds.includes(s)).map((s) => seatKey(showtimeId, s));
    await releaseKeys(dropped, userId, holdId);
  }
  return {
    holdId, showtimeId, seatIds,
    expiresAt: new Date(expiresAt).toISOString(), holdSeconds: config.holdSeconds,
    totalPaise: totalPrice(showtime, seats), currency: 'INR',
  };
}

// Returns the record only if it belongs to userId and every seat key is still owned by it.
async function requireActiveHold(userId, holdId) {
  const rec = await readRecord(String(holdId));
  if (!rec) throw new HttpError(410, 'HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
  if (rec.userId !== userId) throw new HttpError(404, 'HOLD_NOT_FOUND', 'Hold not found.');
  const keys = rec.seatIds.map((s) => seatKey(rec.showtimeId, s));
  const vals = await redis.mget(keys);
  if (vals.some((v) => v !== `${userId}|${rec.holdId}`))
    throw new HttpError(410, 'HOLD_EXPIRED', 'Your seat hold has expired. Please select seats again.');
  return rec;
}

async function getHold(userId, holdId) {
  const rec = await requireActiveHold(userId, holdId);
  return { ...rec, expiresAt: new Date(rec.expiresAt).toISOString(), secondsLeft: Math.max(0, Math.round((rec.expiresAt - Date.now()) / 1000)) };
}

async function releaseHold(userId, holdId) {
  const rec = await readRecord(String(holdId));
  if (!rec) return { released: 0 };                       // already expired = already released
  if (rec.userId !== userId) throw new HttpError(404, 'HOLD_NOT_FOUND', 'Hold not found.');
  const n = await releaseKeys(rec.seatIds.map((s) => seatKey(rec.showtimeId, s)), userId, rec.holdId);
  await redis.del(groupKey(rec.holdId));
  return { released: n };
}

module.exports = { createHold, getHold, releaseHold, requireActiveHold, loadShowtime, loadSeats, seatKey, groupKey, readRecord };
