const express = require('express');
const { pool, expirePendingBookings } = require('./db');
const { redis } = require('./redis');
const { requireAuth, optionalAuth } = require('./auth');
const { HttpError } = require('./errors');
const holds = require('./holdService');
const bookings = require('./bookingService');
const { seatPrice } = require('./pricing');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Location-aware catalogue ----------
router.get('/cities', wrap(async (_req, res) => {
  const [rows] = await pool.query(`SELECT id, name, state FROM rs_cities WHERE is_active = 1 ORDER BY name`);
  res.json({ cities: rows });
}));

// GET /api/shows?city=<name|id>[&movieId=][&date=YYYY-MM-DD]  -> cinemas > movies > showtimes
router.get('/shows', wrap(async (req, res) => {
  const city = String(req.query.city || '').trim();
  if (!city) throw new HttpError(400, 'VALIDATION', 'city is required.');
  const params = [/^\d+$/.test(city) ? Number(city) : city];
  let sql = `
    SELECT ci.id city_id, ci.name city_name, c.id cinema_id, c.name cinema_name, c.address, c.data_source,
           m.id movie_id, m.title, m.language, m.duration_min, m.rating,
           s.id showtime_id, s.starts_at, s.base_price_paise, sc.name screen_name
      FROM rs_showtimes s
      JOIN rs_screens sc ON sc.id = s.screen_id
      JOIN rs_cinemas c  ON c.id = sc.cinema_id
      JOIN rs_cities ci  ON ci.id = c.city_id
      JOIN rs_movies m   ON m.id = s.movie_id
     WHERE ${/^\d+$/.test(city) ? 'ci.id' : 'ci.name'} = ? AND s.status = 'ACTIVE' AND s.starts_at > UTC_TIMESTAMP()`;
  if (req.query.movieId) { sql += ` AND m.id = ?`; params.push(Number(req.query.movieId)); }
  if (req.query.date) { sql += ` AND DATE(s.starts_at) = ?`; params.push(String(req.query.date)); }
  else sql += ` AND s.starts_at < DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)`;
  sql += ` ORDER BY c.name, m.title, s.starts_at`;
  const [rows] = await pool.query(sql, params);

  const cinemas = new Map();
  for (const r of rows) {
    if (!cinemas.has(r.cinema_id))
      cinemas.set(r.cinema_id, { id: r.cinema_id, name: r.cinema_name, address: r.address, dataSource: r.data_source, movies: new Map() });
    const c = cinemas.get(r.cinema_id);
    if (!c.movies.has(r.movie_id))
      c.movies.set(r.movie_id, { id: r.movie_id, title: r.title, language: r.language, durationMin: r.duration_min, rating: r.rating, showtimes: [] });
    c.movies.get(r.movie_id).showtimes.push({
      id: r.showtime_id, startsAt: new Date(r.starts_at).toISOString(), screen: r.screen_name, basePricePaise: r.base_price_paise });
  }
  res.json({
    city, dataNotice: 'Development sample data unless a cinema has dataSource "LIVE". No live availability feed is connected.',
    cinemas: [...cinemas.values()].map((c) => ({ ...c, movies: [...c.movies.values()] })),
  });
}));

// GET /api/shows/:id/seats -> real seat inventory for THAT showtime's screen
router.get('/shows/:id/seats', optionalAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION', 'Invalid showtime id.');
  const [[st]] = await pool.query(
    `SELECT s.id, s.screen_id, s.base_price_paise, s.starts_at, sc.name screen_name, m.title
       FROM rs_showtimes s JOIN rs_screens sc ON sc.id = s.screen_id JOIN rs_movies m ON m.id = s.movie_id WHERE s.id = ?`, [id]);
  if (!st) throw new HttpError(404, 'SHOWTIME_NOT_FOUND', 'Showtime not found.');
  await expirePendingBookings();
  const [seats] = await pool.query(
    `SELECT id, row_label, seat_number, category, price_multiplier FROM rs_screen_seats WHERE screen_id = ? ORDER BY row_label, seat_number`, [st.screen_id]);
  const [booked] = await pool.query(`SELECT seat_id FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1`, [id]);
  const bookedSet = new Set(booked.map((r) => r.seat_id));
  const held = seats.length ? await redis.mget(seats.map((s) => holds.seatKey(id, s.id))) : [];
  res.json({
    showtimeId: id, movie: st.title, screen: st.screen_name, startsAt: new Date(st.starts_at).toISOString(),
    seats: seats.map((s, i) => {
      let status = 'AVAILABLE';
      if (bookedSet.has(s.id)) status = 'BOOKED';
      else if (held[i]) status = req.userId && held[i].startsWith(`${req.userId}|`) ? 'HELD_BY_YOU' : 'HELD';
      return { id: s.id, row: s.row_label, number: s.seat_number, category: s.category, pricePaise: seatPrice(st, s), status };
    }),
  });
}));

// ---------- Seat holds ----------
router.post('/holds', requireAuth, wrap(async (req, res) => res.status(201).json(await holds.createHold(req.userId, req.body || {}))));
router.get('/holds/:holdId', requireAuth, wrap(async (req, res) => res.json(await holds.getHold(req.userId, req.params.holdId))));
router.delete('/holds/:holdId', requireAuth, wrap(async (req, res) => res.json(await holds.releaseHold(req.userId, req.params.holdId))));

// ---------- Checkout / bookings ----------
router.post('/checkout', requireAuth, wrap(async (req, res) => {
  const { holdId } = req.body || {};
  if (!holdId) throw new HttpError(400, 'VALIDATION', 'holdId is required.');   // totals from the client are ignored
  const booking = await bookings.createCheckout(req.userId, holdId);
  // Honest response: a pending booking exists, but NO payment provider is integrated, so nothing is paid or confirmed.
  res.status(501).json({
    status: 'PAYMENT_INTEGRATION_PENDING',
    message: 'Seats are reserved for payment, but payment integration is not implemented yet. This booking is NOT confirmed.',
    booking,
  });
}));
router.get('/bookings/mine', requireAuth, wrap(async (req, res) => res.json({ bookings: await bookings.myBookings(req.userId) })));
router.post('/bookings/:id/cancel', requireAuth, wrap(async (req, res) => res.json(await bookings.cancelBooking(req.userId, req.params.id))));

router.use((err, _req, res, _next) => {
  if (err instanceof HttpError)
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  console.error('[ticketing]', err && err.message);          // message only: never dump env/config objects
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
});
module.exports = router;
