console.log("EVENT ROUTES FILE LOADED - VERSION 4");

const express = require("express");
const router = express.Router();
const db = require("../db/database");
const client = require("../cache/redisClient");
const authenticateToken = require("../middleware/authMiddleware");

// =======================
// Create Event
// =======================
router.post("/events", async (req, res) => {

    try {

        const { event_name, event_date } = req.body;

        const [result] = await db.query(
            "INSERT INTO events (event_name, event_date) VALUES (?, ?)",
            [event_name, event_date]
        );

        // Invalidate events cache
        await client.del("events");

        res.json({
            message: "Event created successfully",
            eventId: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    }

});

// =======================
// Get All Events (Redis Cache)
// =======================
router.get("/events", async (req, res) => {

    try {

        const cachedEvents = await client.get("events");

        if (cachedEvents) {

            console.log("Event Cache Hit");

            return res.json({
                source: "Redis Cache",
                data: JSON.parse(cachedEvents)
            });

        }

        console.log("Event Cache Miss");

        const [results] = await db.query(
            "SELECT * FROM events"
        );

        await client.setEx(
            "events",
            60,
            JSON.stringify(results)
        );

        res.json({
            source: "MySQL Database",
            data: results
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    }

});

// =======================
// Test Route
// =======================
router.get("/test", (req, res) => {

    res.send("Test Route Working");

});

// =======================
// Get Seats (Redis Cache)
// =======================
router.get("/events/:eventId/seats", async (req, res) => {

    try {

        const { eventId } = req.params;

        const cacheKey = `event:${eventId}:seats`;

        // Check Redis
        const cachedSeats = await client.get(cacheKey);

        if (cachedSeats) {

            console.log("Seat Cache Hit");

            return res.json({
                source: "Redis Cache",
                data: JSON.parse(cachedSeats)
            });

        }

        console.log("Seat Cache Miss");

        const [results] = await db.query(
            "SELECT * FROM seats WHERE event_id = ?",
            [eventId]
        );

        // Store in Redis for 60 seconds
        await client.setEx(
            cacheKey,
            60,
            JSON.stringify(results)
        );

        res.json({
            source: "MySQL Database",
            data: results
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    }

});

// =======================
// Book Seat
// =======================
router.post("/book-seat", authenticateToken, async (req, res) => {

    const { seat_id } = req.body;
    const user_id = req.user.id;

    const lockKey = `lock:seat:${seat_id}`;

    let connection;

    try {

        // Acquire Redis Lock
        const lock = await client.set(
            lockKey,
            "locked",
            {
                NX: true,
                EX: 10
            }
        );

        if (!lock) {

            return res.status(409).json({
                message: "Seat is currently being booked. Please try again."
            });

        }

        // Get dedicated DB connection
        connection = await db.getConnection();

        // Start transaction
        await connection.beginTransaction();

        // Check seat
        const [seatResults] = await connection.query(
            "SELECT * FROM seats WHERE id = ?",
            [seat_id]
        );

        if (seatResults.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                message: "Seat not found"
            });

        }

        if (seatResults[0].is_booked) {

            await connection.rollback();

            return res.status(400).json({
                message: "Seat already booked"
            });

        }

        // Insert booking
        const [bookingResult] = await connection.query(
            "INSERT INTO bookings (user_id, seat_id) VALUES (?, ?)",
            [user_id, seat_id]
        );

        // Mark seat as booked
        await connection.query(
            "UPDATE seats SET is_booked = 1 WHERE id = ?",
            [seat_id]
        );

        // Commit transaction
        await connection.commit();

        // Invalidate seat cache
        const eventId = seatResults[0].event_id;

        await client.del(`event:${eventId}:seats`);

        res.json({
            message: "Seat booked successfully",
            bookingId: bookingResult.insertId
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    } finally {

        // Release DB connection
        if (connection) {
            connection.release();
        }

        // Release Redis lock
        await client.del(lockKey);

    }

});

// =======================
// Cancel Booking
// =======================
router.delete("/cancel-booking/:seatId", async (req, res) => {

    const { seatId } = req.params;

    let connection;

    try {

        connection = await db.getConnection();

        await connection.beginTransaction();

        // Check seat
        const [seatResults] = await connection.query(
            "SELECT * FROM seats WHERE id = ?",
            [seatId]
        );

        if (seatResults.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                message: "Seat not found"
            });

        }

        const eventId = seatResults[0].event_id;

        // Delete booking
        await connection.query(
            "DELETE FROM bookings WHERE seat_id = ?",
            [seatId]
        );

        // Mark seat available
        await connection.query(
            "UPDATE seats SET is_booked = 0 WHERE id = ?",
            [seatId]
        );

        await connection.commit();

        // Clear Redis seat cache
        await client.del(`event:${eventId}:seats`);

        res.json({
            message: "Booking cancelled successfully"
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

});

// ======================
// Get My Bookings
// ======================
router.get("/my-bookings/:userId", async (req, res) => {

    const { userId } = req.params;

    try {

        const [bookings] = await db.query(
            `
            SELECT
                b.id AS booking_id,
                e.event_name,
                e.event_date,
                s.seat_number
            FROM bookings b
            JOIN seats s
                ON b.seat_id = s.id
            JOIN events e
                ON s.event_id = e.id
            WHERE b.user_id = ?
            ORDER BY e.event_date;
            `,
            [userId]
        );

        res.json({
            message: "Bookings fetched successfully",
            data: bookings
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error fetching bookings"
        });

    }

});

module.exports = router;