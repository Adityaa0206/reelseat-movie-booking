# 🎟️ Ticket Booking System

A backend ticket booking system built with **Express.js**, **MySQL**, and **Redis** that demonstrates caching, distributed locking, and REST API development.

## 🚀 Features

- User Authentication (In Progress)
- Event Listing
- Seat Availability
- Seat Booking
- Redis Event Caching
- Redis Distributed Locking
- MySQL Database
- Dockerized Redis
- RESTful APIs

---

## 🛠 Tech Stack

- Node.js
- Express.js
- MySQL
- Redis
- Docker
- JavaScript

---

## Project Structure

```
ticket-booking-system
│
├── frontend
├── server
│   ├── cache
│   ├── db
│   ├── middleware
│   ├── routes
│   ├── services
│   ├── index.js
│   └── package.json
└── README.md
```

---

## API Endpoints

### Events

GET /api/events

Returns all events.

---

### Seats

GET /events/:eventId/seats

Returns available seats.

---

### Book Seat

POST /api/book-seat

Books a seat using Redis distributed locking to prevent race conditions.

---

## Redis Features

### Caching

- Event list cached in Redis
- Faster response times
- Reduced MySQL queries

### Distributed Locking

- Prevents double booking
- Ensures only one user books a seat at a time
- Lock released after booking completes

---

## Setup

```bash
git clone <repository>

cd server

npm install

npm start
```

Start Redis using Docker:

```bash
docker run -d --name redis-cache -p 9000:6379 redis
```

Update Redis connection:

```
redis://localhost:9000
```

---

## Future Improvements

- JWT Authentication
- Payment Integration
- Booking History
- Admin Dashboard
- Email Notifications
