require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db/database");
const eventRoutes = require("./routes/eventRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());

// ======================
// API Routes
// ======================
app.use("/api", eventRoutes);
app.use("/api/auth", authRoutes);

// ======================
// Serve Frontend
// ======================
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ======================
// Test Route
// ======================
app.get("/hello", (req, res) => {
    res.send("Hello Route Working");
});

// ======================
// Start Server
// ======================
const PORT = 3000;

app.listen(PORT, () => {
    console.log("About to start server...");
    console.log(`Server running on port ${PORT}`);
});

// ======================
// Error Handling
// ======================
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
});