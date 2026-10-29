## Seat holds, checkout and locations (added)

### Windows setup
1. Install Node.js 20+, MySQL 8 and Docker Desktop.
2. Start Redis: `docker run -d --name redis-cache -p 9000:6379 redis`
3. In PowerShell:
   ```
   cd server
   npm install
   npm install ioredis mysql2 jsonwebtoken dotenv
   copy .env.example .env      # then edit DB_*, JWT_SECRET
   mysql -u root -p your_database < migrations\001_ticketing.sql
   node ticketing\seedSample.js
   npm start
   ```
4. Second terminal: `cd frontend; npm install; npm run dev`

### Sample data
`ticketing/seedSample.js` creates **fictional sample cinemas/movies/showtimes** (`data_source = 'SAMPLE'`). There is no live cinema availability feed.

### Testing (PowerShell, replace TOKEN with a JWT from your login)
```
curl.exe "http://localhost:5000/api/shows?city=Hyderabad"
curl.exe "http://localhost:5000/api/shows/1/seats"
curl.exe -X POST http://localhost:5000/api/holds -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"showtimeId\":1,\"seatIds\":[1,2]}"
```
Repeat the hold with a second user's token: expect `409 SEATS_UNAVAILABLE`. Wait `SEAT_HOLD_SECONDS`: expect `410 HOLD_EXPIRED` from `GET /api/holds/:id`.
`POST /api/checkout` returns **501 PAYMENT_INTEGRATION_PENDING** by design: payment is not integrated and nothing is marked paid.
