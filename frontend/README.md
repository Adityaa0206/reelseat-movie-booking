# Reelseat frontend (React + Vite)
Frontend only. The `server/` directory is untouched.

## Windows / VS Code setup
```
cd ticket-booking-system\frontend
copy .env.example .env
npm install
npm run dev
```
Open http://localhost:5173. Start the backend separately (`node server\server.js` or your usual command) on port 3000. Backend must allow CORS from http://localhost:5173.

## Works now (real backend)
Register, login, persistent JWT session (token only, never passwords), logout, Authorization header, protected routes, My Bookings (`GET /api/my-bookings/:userId`), all UI states.
## Works now (MOCK data, see src/data/mockData.js and movieService.js)
Movie list/search, details, dates, cinemas, showtimes, seat layout and statuses.
## Awaiting backend (shows an honest error until implemented)
Seat hold, checkout/payment, booking verification, forgot/reset password. Nothing is simulated as successful.

## Backend contracts needed
- `GET /movies`, `GET /movies/:id`, `GET /movies/:id/shows?date=` -> movies, cinemas, shows
- `GET /shows/:showId/seats` -> `[{id,row,number,category,price,status:available|held|booked}]`
- `POST /holds {showId,seatIds}` -> `{holdId,expiresAt}`; `DELETE /holds/:holdId` (Redis lock lives here)
- `POST /checkout {holdId}` -> `{bookingId,paymentUrl}`; gateway redirects back to `/confirmation/:bookingId` (success), `/checkout?status=failed|cancelled`
- `GET /bookings/:id` -> `{id,status:CONFIRMED|PENDING|FAILED,paymentStatus,movie,cinema,showtime,seats}` (set by payment webhook)
- `POST /auth/forgot-password {email}`, `POST /auth/reset-password {token,password}`
- Login response: `{token,user:{id,username}}`
