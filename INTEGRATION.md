# Applying this patch to ReelSeat

Copy the folders in this bundle into your repo root (they only ADD files; nothing is overwritten).

## 1. Backend
```
cd server
npm install ioredis mysql2 jsonwebtoken dotenv
```
Run the migration, then (optionally) the sample seed:
```
mysql -u <user> -p <database> < migrations\001_ticketing.sql
node ticketing\seedSample.js
```
Mount the router in `server/index.js` (after `express.json()` and CORS, before your 404 handler):
```js
app.use('/api', require('./ticketing/routes'));
```
If your login token stores the user id under a claim other than `id`/`userId`/`user_id`/`sub`, edit `ticketing/auth.js`.
Create `server/.env` from `.env.example` (JWT_SECRET must match the secret your login route signs with).

## 2. Frontend (UI untouched)
Add `src/services/ticketingApi.js`, set `VITE_API_URL` in `frontend/.env` if the API is not on `http://localhost:5000`,
then make three changes in your existing components (I could not read them, so wire these by hand):

**Location change** (navbar state / context):
```js
useEffect(() => {
  setLoading(true);
  getShows(city).then(setShows).catch(e => setError(e.message)).finally(() => setLoading(false));
  setSelectedShowtime(null); setSelectedSeats([]);          // old seats don't belong to the new city
}, [city]);
```
**Seat page**: load `getShowSeats(showtime.id)` and render `seat.status` (`AVAILABLE`, `HELD`, `HELD_BY_YOU`, `BOOKED`) with your existing seat styles;
replace the static layout. Group by `seat.row`, order by `seat.number`.

**Seat click / continue**: 
```js
try {
  const h = await holdSeats(showtime.id, selectedSeatIds, hold?.holdId);   // pass holdId to change selection
  setHold(h);                                                             // h.expiresAt drives your countdown
  const r = await checkout(h.holdId);                                     // r.httpStatus === 501 => payment not integrated
} catch (e) {
  if (e.code === 'SEATS_UNAVAILABLE') { /* mark e.details.seatIds unavailable, refresh seats */ }
  else if (e.code === 'HOLD_EXPIRED') { /* clear hold, refresh seats, tell user */ }
  else if (e.status === 401) { /* send to login */ }
  else setError(e.message);
}
```
On "back"/unmount call `releaseHold(hold.holdId)`.

## Contract (new)
| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | /api/cities | - | `{cities}` | |
| GET | /api/shows?city= | - | `{cinemas>movies>showtimes}` | 400 |
| GET | /api/shows/:id/seats | - (auth optional) | `{seats[]}` | 404 |
| POST | /api/holds | `{showtimeId, seatIds[], holdId?}` | 201 `{holdId, expiresAt, totalPaise,...}` | 400, 401, 409 SEATS_UNAVAILABLE |
| GET | /api/holds/:id | - | `{secondsLeft,...}` | 401, 404, 410 HOLD_EXPIRED |
| DELETE | /api/holds/:id | - | `{released}` | 401, 404 |
| POST | /api/checkout | `{holdId}` | **501** `PAYMENT_INTEGRATION_PENDING` + pending booking | 401, 409, 410 |
| POST | /api/bookings/:id/cancel | - | `{status}` | 401, 404, 409 |
| GET | /api/bookings/mine | - | `{bookings}` | 401 |
